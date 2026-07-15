import { NextRequest, NextResponse } from "next/server";
import type { ActionType } from "@/lib/types";
import { buildFollowUpMessages } from "@/lib/prompts";
import { callOpenAIChat } from "@/lib/ai-answer";
import { getArticleBySlug } from "@/lib/news";
import { getSearchContext } from "@/lib/web-search";

interface FollowUpRequest {
  question: string;
  selectedText: string;
  articleId: string;
  articleTitle: string;
  context: string;
  initialResponse: string;
  actionType: ActionType;
  history: { role: "user" | "assistant"; text: string }[];
}

function getMockFollowUp(question: string): string {
  const normalized = question.trim().replace(/\?$/, "").toLowerCase();
  if (normalized.includes("gyventoj") && normalized.includes("kaun")) {
    return "Pagal naujausius viešai prieinamus duomenis Kaune gyvena apie 315 tūkst. gyventojų.";
  }
  return "Atsakymo šiuo metu neturiu — pabandykite paklausti kitaip.";
}

export async function POST(request: NextRequest) {
  try {
    const body: FollowUpRequest = await request.json();

    if (!body.question?.trim() || !body.selectedText || !body.initialResponse) {
      return NextResponse.json(
        { error: "Trūksta privalomų laukų" },
        { status: 400 }
      );
    }

    const article = await getArticleBySlug(body.articleId);
    const title = body.articleTitle || article?.title || "Straipsnis";
    let context = body.context;
    if (article?.originalUrl) {
      context = `${context}\n\nOriginalus šaltinis: ${article.originalUrl}`;
    }

    let text: string;

    if (process.env.OPENAI_API_KEY) {
      try {
        const searchContext = await getSearchContext(body.question, {
          selectedText: body.selectedText,
          articleTitle: title,
          always: Boolean(process.env.TAVILY_API_KEY),
        });

        text = await callOpenAIChat(
          buildFollowUpMessages(
            title,
            body.selectedText,
            context,
            body.initialResponse,
            body.question,
            body.history,
            searchContext
          )
        );
      } catch {
        text = getMockFollowUp(body.question);
      }
    } else {
      text = getMockFollowUp(body.question);
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Vidinė serverio klaida" },
      { status: 500 }
    );
  }
}
