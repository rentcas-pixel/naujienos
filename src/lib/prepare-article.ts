import type { Article, TopicAnglesPack } from "./types";
import { getArticleBySlug } from "./news";
import { editHeadlinesForDisplay } from "./headline-transform";
import {
  expandArticleContent,
  isShortRssArticle,
} from "./expand-article";
import { generateTopicAnglesPackForArticle } from "./topic-angles";
import {
  markPublishSkipped,
  readPreparedPublish,
  writePreparedPublish,
  getPublishSkipReason,
} from "./topic-angles-store";

function excerptFromArticle(article: Article): string {
  return article.paragraphs
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function emptyPack(): TopicAnglesPack {
  return { angles: [], generatedAt: new Date().toISOString() };
}

/**
 * RSS → antraštė → tekstas → (Kitu kampu jei pavyksta) → feed.
 * Jei rakursai nepavyksta — vis tiek publikuojam straipsnį be „Kitu kampu“.
 */
export async function prepareArticleForPublish(
  slug: string
): Promise<{
  article: Article;
  pack: TopicAnglesPack;
} | null> {
  if (!slug) return null;

  const existing = await readPreparedPublish(slug);
  if (existing?.article?.paragraphs?.length) {
    return { article: existing.article, pack: existing.pack };
  }

  const skipReason = await getPublishSkipReason(slug);
  if (skipReason === "promotional") return null;

  const base = await getArticleBySlug(slug);
  if (!base) return null;

  if (base.isPromotional) {
    await markPublishSkipped(slug, "promotional");
    return null;
  }

  const seedExcerpt = excerptFromArticle(base);

  const [edited] = await editHeadlinesForDisplay(
    [
      {
        id: base.slug,
        title: base.title,
        excerpt: seedExcerpt,
        language: "lt" as const,
      },
    ],
    { budgetMs: 12000, maxItems: 1 }
  );

  let article: Article = edited
    ? { ...base, title: edited.title }
    : base;

  if (isShortRssArticle(article)) {
    article = await expandArticleContent(article);
  }

  // Rakursai — best effort (neblouoja publish)
  const pack =
    (await generateTopicAnglesPackForArticle(article, {
      markSkipped: false,
    })) ?? emptyPack();

  await writePreparedPublish({
    slug,
    title: article.title,
    excerpt: excerptFromArticle(article),
    article,
    pack,
  });

  return { article, pack };
}
