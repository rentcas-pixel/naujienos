import { NextRequest, NextResponse } from "next/server";
import type { ActionType, ExplainResponse } from "@/lib/types";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import { getMockResponse } from "@/lib/mock-responses";
import { getArticleBySlug } from "@/lib/news";
import { getOpenAIModel } from "@/lib/openai-config";

interface ExplainRequest {
  selectedText: string;
  articleId: string;
  actionType: ActionType;
  context: string;
  articleTitle: string;
}

async function callOpenAI(
  actionType: ActionType,
  selectedText: string,
  articleTitle: string,
  context: string
): Promise<ExplainResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No API key");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      messages: [
        { role: "system", content: buildSystemPrompt(actionType) },
        {
          role: "user",
          content: buildUserPrompt(selectedText, articleTitle, context),
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });

  if (!res.ok) throw new Error("OpenAI request failed");

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  return {
    text,
    sources: [],
    actionType,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ExplainRequest = await request.json();
    const { selectedText, articleId, actionType, context, articleTitle } =
      body;

    if (!selectedText || !actionType) {
      return NextResponse.json(
        { error: "Trūksta privalomų laukų" },
        { status: 400 }
      );
    }

    const article = await getArticleBySlug(articleId);
    const title = articleTitle || article?.title || "Straipsnis";

    let response: ExplainResponse;

    if (process.env.OPENAI_API_KEY) {
      try {
        response = await callOpenAI(
          actionType,
          selectedText,
          title,
          context
        );
      } catch {
        response = getMockResponse(selectedText, actionType);
      }
    } else {
      response = getMockResponse(selectedText, actionType);
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Vidinė serverio klaida" },
      { status: 500 }
    );
  }
}
