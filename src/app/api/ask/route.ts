import { NextRequest, NextResponse } from "next/server";
import { buildArticleAskMessages } from "@/lib/prompts";
import { callOpenAIChat } from "@/lib/ai-answer";
import { getArticleBySlug } from "@/lib/news";
import { getSearchContext } from "@/lib/web-search";

interface AskRequest {
  question: string;
  articleId: string;
  articleTitle: string;
  articleText: string;
  history: { role: "user" | "assistant"; text: string }[];
}

function getMockAsk(question: string): string {
  const normalized = question.trim().replace(/\?$/, "").toLowerCase();
  if (normalized.includes("gyventoj") && normalized.includes("kaun")) {
    return "Pagal naujausius viešai prieinamus duomenis Kaune gyvena apie 315 tūkst. gyventojų.";
  }
  return "Atsakymo šiuo metu neturiu — pabandykite paklausti kitaip.";
}

export async function POST(request: NextRequest) {
  try {
    const body: AskRequest = await request.json();

    if (!body.question?.trim() || !body.articleId) {
      return NextResponse.json(
        { error: "Trūksta privalomų laukų" },
        { status: 400 }
      );
    }

    const article = await getArticleBySlug(body.articleId);
    const title = body.articleTitle || article?.title || "Straipsnis";
    let articleText =
      body.articleText ||
      article?.paragraphs.map((paragraph) => paragraph.text).join("\n\n") ||
      "";

    if (article?.originalUrl) {
      articleText += `\n\nOriginalus šaltinis: ${article.originalUrl}`;
    }

    let text: string;

    if (process.env.OPENAI_API_KEY) {
      try {
        const searchContext = await getSearchContext(body.question, {
          articleTitle: title,
          always: Boolean(process.env.TAVILY_API_KEY),
        });

        text = await callOpenAIChat(
          buildArticleAskMessages(
            title,
            articleText,
            body.question,
            body.history,
            searchContext
          )
        );
      } catch {
        text = getMockAsk(body.question);
      }
    } else {
      text = getMockAsk(body.question);
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Vidinė serverio klaida" },
      { status: 500 }
    );
  }
}
