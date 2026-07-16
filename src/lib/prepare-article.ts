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

/** Minimali straipsnio apimtis po paruošimo */
const MIN_ARTICLE_CHARS = 280;

function excerptFromArticle(article: Article): string {
  return article.paragraphs
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function articleBodyChars(article: Article): number {
  return article.paragraphs
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function hasQualityPack(pack: TopicAnglesPack | null | undefined): boolean {
  return Boolean(pack?.angles?.some((angle) => angle.facts?.length > 0));
}

/**
 * Kokybė > kiekis.
 * Į feed’ą TIK jei yra normalus straipsnis IR normalus „Kitu kampu“.
 */
export async function prepareArticleForPublish(
  slug: string
): Promise<{
  article: Article;
  pack: TopicAnglesPack;
} | null> {
  if (!slug) return null;

  const existing = await readPreparedPublish(slug);
  if (
    existing?.article?.paragraphs?.length &&
    hasQualityPack(existing.pack)
  ) {
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

  if (articleBodyChars(article) < MIN_ARTICLE_CHARS) {
    await markPublishSkipped(slug, "thin");
    return null;
  }

  // Be kokybiško „Kitu kampu“ — NEpublikuojam
  const pack = await generateTopicAnglesPackForArticle(article, {
    markSkipped: true,
  });
  if (!hasQualityPack(pack)) {
    return null;
  }

  await writePreparedPublish({
    slug,
    title: article.title,
    excerpt: excerptFromArticle(article),
    article,
    pack: pack!,
  });

  return { article, pack: pack! };
}
