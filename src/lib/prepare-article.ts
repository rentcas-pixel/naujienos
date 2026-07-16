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
  isPublishSkipped,
} from "./topic-angles-store";

function excerptFromArticle(article: Article): string {
  return article.paragraphs
    .map((p) => p.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

/**
 * Pilnas publish pipeline:
 * RSS → antraštė → tekstas → Kitu kampu + QA → įrašas DB.
 * Tik tada feed’e (status=ready).
 */
export async function prepareArticleForPublish(
  slug: string
): Promise<{
  article: Article;
  pack: TopicAnglesPack;
} | null> {
  if (!slug) return null;

  const existing = await readPreparedPublish(slug);
  if (existing?.article && existing.pack?.angles?.length) {
    return { article: existing.article, pack: existing.pack };
  }

  if (await isPublishSkipped(slug)) return null;

  const base = await getArticleBySlug(slug);
  if (!base) return null;

  if (base.isPromotional) {
    await markPublishSkipped(slug, "promotional");
    return null;
  }

  const seedExcerpt = excerptFromArticle(base);

  // 1) Antraštė (tas pats editorius kaip feed’e)
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

  // 2) Pilnas tekstas (jei RSS plonas — expand)
  if (isShortRssArticle(article)) {
    article = await expandArticleContent(article);
  }

  // 3–4) Kitu kampu + novelty + AI QA
  const pack = await generateTopicAnglesPackForArticle(article);
  if (!pack) return null;

  // 5) Įrašom viską — tik tada feed
  await writePreparedPublish({
    slug,
    title: article.title,
    excerpt: excerptFromArticle(article),
    article,
    pack,
  });

  return { article, pack };
}
