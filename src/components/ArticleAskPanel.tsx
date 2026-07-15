"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionType, Article, FollowUpMessage } from "@/lib/types";
import { ACTION_LABELS, ACTION_ORDER } from "@/lib/types";
import { AiAskForm, AiPanel } from "./AiPanel";

const SUGGESTED_PROMPTS = [
  "Kokia šios temos esmė?",
  "Ką tai reiškia paprastai?",
  "Kokios pasekmės žmonėms?",
  "Kas čia nepatvirtinta?",
];

interface ArticleAskPanelProps {
  article: Article;
  inline?: boolean;
  selectedText?: string;
  initialResponse?: string;
  actionType?: ActionType;
  /** Viso straipsnio greiti veiksmai (mobilėje / apačioje) */
  showQuickActions?: boolean;
  onQuickAction?: (action: ActionType) => void;
  quickActionLoading?: ActionType | null;
}

export function ArticleAskPanel({
  article,
  inline = false,
  selectedText,
  initialResponse,
  actionType,
  showQuickActions = false,
  onQuickAction,
  quickActionLoading = null,
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

  const runAskRef = useRef(runAsk);
  runAskRef.current = runAsk;

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<{ question?: string }>).detail;
      const next = detail?.question?.trim();
      if (!next) return;
      void runAskRef.current(next);
    };

    window.addEventListener("article-ask-prefill", onPrefill);
    return () => window.removeEventListener("article-ask-prefill", onPrefill);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await runAsk(question.trim());
  };

  return (
    <AiPanel
      title="Klauskite AI"
      subtitle={
        selectedText
          ? "Užduokite savo klausimą apie pažymėtą temą ar visą straipsnį."
          : "Pasirinkite promptą arba užduokite savo klausimą apie straipsnį."
      }
      attached={inline && Boolean(selectedText)}
      className={inline ? "my-0" : "mt-8 mb-28 md:mb-8"}
    >
      <div id={inline ? undefined : "article-ask-panel"}>
      {showQuickActions && onQuickAction && (
        <div className="mb-4" role="toolbar" aria-label="Greiti AI veiksmai">
          <p className="text-[12px] font-bold uppercase tracking-wide text-bbc-gray mb-2">
            Promptai
          </p>
          <div className="flex flex-wrap gap-2">
            {ACTION_ORDER.map((action) => {
              const isLoading = quickActionLoading === action;
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => onQuickAction(action)}
                  disabled={!!quickActionLoading || loading}
                  className={`bbc-ai-tab min-h-11 ${
                    isLoading ? "opacity-60 cursor-wait" : ""
                  }`}
                >
                  {isLoading ? "..." : ACTION_LABELS[action]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!selectedText && (
        <div className="mb-4 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={loading}
              onClick={() => void runAsk(prompt)}
              className="bbc-ai-chip"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

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
        placeholder={
          selectedText
            ? "Pvz.: Ką tai reiškia paprastai? Kas dar svarbu?"
            : "Pvz.: Kokia šios temos esmė? Ką verta žinoti?"
        }
      />
      </div>
    </AiPanel>
  );
}
