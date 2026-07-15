"use client";

import { useState } from "react";
import type { ActionType, Article, FollowUpMessage } from "@/lib/types";
import { AiAskForm, AiPanel } from "./AiPanel";

interface ArticleAskPanelProps {
  article: Article;
  inline?: boolean;
  selectedText?: string;
  initialResponse?: string;
  actionType?: ActionType;
}

/** Tik po AI atsako — papildomam klausimui apie pažymėtą tekstą. */
export function ArticleAskPanel({
  article,
  inline = false,
  selectedText,
  initialResponse,
  actionType,
}: ArticleAskPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<FollowUpMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const articleText = article.paragraphs
    .map((paragraph) => paragraph.text)
    .join("\n\n");

  const runAsk = async (trimmed: string) => {
    if (!trimmed || loading) return;

    const userMsgId = crypto.randomUUID();
    const history = messages.map((message) => ({
      role: message.role,
      text: message.text,
    }));

    setQuestion("");
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: trimmed },
    ]);
    setLoading(true);

    try {
      const useFollowUp = Boolean(selectedText && initialResponse && actionType);
      const res = await fetch(useFollowUp ? "/api/followup" : "/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useFollowUp
            ? {
                question: trimmed,
                selectedText: selectedText!,
                articleId: article.slug,
                articleTitle: article.title,
                context: articleText.slice(0, 800),
                initialResponse: initialResponse!,
                actionType: actionType!,
                history,
              }
            : {
                question: trimmed,
                articleId: article.slug,
                articleTitle: article.title,
                articleText,
                history,
              }
        ),
      });

      if (!res.ok) throw new Error("Nepavyko gauti atsakymo");

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.text,
        },
      ]);
    } catch {
      setMessages((prev) => prev.filter((message) => message.id !== userMsgId));
      setQuestion(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await runAsk(question.trim());
  };

  return (
    <AiPanel
      title="Klauskite toliau"
      subtitle="Papildomas klausimas apie pažymėtą tekstą."
      attached={inline}
      className="my-0"
    >
      {messages.length > 0 && (
        <div className="mb-4 space-y-0">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`bbc-ai-message ${
                message.role === "user"
                  ? "bbc-ai-message--user"
                  : "bbc-ai-message--assistant"
              }`}
            >
              <span className="font-bold text-[12px] uppercase tracking-wide text-bbc-gray block mb-1">
                {message.role === "user" ? "Jūs" : "AI atsakymas"}
              </span>
              {message.text}
            </div>
          ))}

          {loading && (
            <div className="bbc-ai-message space-y-2 animate-pulse">
              <div className="h-3 bg-bbc-bg-soft w-4/5" />
              <div className="h-3 bg-bbc-bg-soft w-3/5" />
            </div>
          )}
        </div>
      )}

      <AiAskForm
        value={question}
        onChange={setQuestion}
        onSubmit={handleSubmit}
        loading={loading}
        placeholder="Klausk..."
        buttonLabel="Klausk"
      />
    </AiPanel>
  );
}
