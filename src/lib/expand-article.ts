import { unstable_cache } from "next/cache";
import type { Article } from "./types";
import { buildExpandArticlePrompt } from "./prompts";
import { estimateReadingTime } from "./html-utils";
import { getOpenAIModel } from "./openai-config";
import {
  parseExpandedArticle,
  toArticleParagraphs,
  toBriefingMeta,
  buildMockExpansion,
} from "./article-briefing";

export const SHORT_ARTICLE_MAX_CHARS = 700;

export function isShortRssArticle(article: Article): boolean {
  if (!article.originalUrl || article.isPromotional) return false;
  const text = article.paragraphs.map((paragraph) => paragraph.text).join("\n\n");
  return text.trim().length <= SHORT_ARTICLE_MAX_CHARS;
}

function extractJsonPayload(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

async function callOpenAIExpand(
  articleTitle: string,
  summary: string,
  source?: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { system, user } = buildExpandArticlePrompt(
    articleTitle,
    summary,
    source
  );

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOpenAIModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 1400,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}

async function expandArticleContent(article: Article): Promise<Article> {
  const summary = article.paragraphs.map((paragraph) => paragraph.text).join("\n\n");

  const raw =
    (await callOpenAIExpand(article.title, summary, article.source)) ?? null;

  const expanded =
    (raw ? parseExpandedArticle(extractJsonPayload(raw)) : null) ??
    buildMockExpansion(summary);

  const paragraphs = toArticleParagraphs(
    expanded.keyFacts,
    expanded.paragraphs
  );
  const briefing = toBriefingMeta(expanded);
  const fullText = paragraphs.map((paragraph) => paragraph.text).join(" ");

  return {
    ...article,
    briefing,
    paragraphs,
    timeline:
      briefing.timeline.length > 0 ? briefing.timeline : article.timeline,
    readingTime: estimateReadingTime(fullText),
    isAiExpanded: true,
  };
}

const getCachedExpandedArticle = unstable_cache(
  async (slug: string) => {
    const { getArticleBySlug } = await import("./news");
    const article = await getArticleBySlug(slug);
    if (!article || !isShortRssArticle(article)) return null;
    return expandArticleContent(article);
  },
  ["expand-rss-article-v6"],
  { revalidate: 86400 }
);

export async function prepareArticleForReading(
  article: Article
): Promise<Article> {
  if (!isShortRssArticle(article)) return article;

  const cached = await getCachedExpandedArticle(article.slug);
  return cached ?? article;
}
