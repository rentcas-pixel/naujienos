import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug, findRelatedHeadlines } from "@/lib/news";
import { prepareArticleForReading } from "@/lib/expand-article";
import { SiteHeader } from "@/components/SiteHeader";
import { ArticlePageClient } from "@/components/ArticlePageClient";

export const revalidate = 900;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const baseArticle = await getArticleBySlug(slug);

  if (!baseArticle) notFound();

  const article = await prepareArticleForReading(baseArticle);

  const excerpt = article.paragraphs.map((p) => p.text).join(" ").slice(0, 400);

  const related =
    article.alternativePerspectives.length > 0
      ? article.alternativePerspectives
      : await findRelatedHeadlines(
          {
            title: article.title,
            excerpt,
            relatedTopics: article.briefing?.relatedTopics,
            excludeSlug: slug,
            currentSource: article.source,
          },
          4
        );

  const articleWithRelated = { ...article, alternativePerspectives: related };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <main className="max-w-[720px] mx-auto px-4 py-8">
        <p className="bbc-meta mb-3">
          <span>{article.category}</span>
          {article.source && (
            <>
              <span className="bbc-meta__dot">|</span>
              <span>{article.source}</span>
            </>
          )}
          <span className="bbc-meta__dot">|</span>
          <span>{article.publishedAt}</span>
          <span className="bbc-meta__dot">|</span>
          <span>{article.readingTime}</span>
        </p>

        <h1 className="bbc-headline-hero text-bbc-black mb-6">{article.title}</h1>

        {article.imageUrl && (
          <div className="relative aspect-[16/9] bg-gray-200 overflow-hidden mb-6 -mx-4 md:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {article.originalUrl && (
          <p className="bbc-meta mb-6 pb-4 border-b border-bbc-border">
            {article.isPromotional ? (
              <>
                Kompanijos pranešimas žiniasklaidai ·{" "}
                <Link
                  href={article.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bbc-red font-semibold hover:underline"
                >
                  Originalus straipsnis →
                </Link>
              </>
            ) : article.isAiExpanded ? (
              <>
                Išplėsta RSS santrauka (AI) ·{" "}
                <Link
                  href={article.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bbc-red font-semibold hover:underline"
                >
                  Originalus straipsnis →
                </Link>
              </>
            ) : (
              <>
                RSS santrauka ·{" "}
                <Link
                  href={article.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bbc-red font-semibold hover:underline"
                >
                  Skaityti pilną straipsnį →
                </Link>
              </>
            )}
          </p>
        )}

        <p className="bbc-meta mb-8 pb-6 border-b border-bbc-border">
          Pažymėkite tekstą — po juo atsiras AI juosta: Paaiškink · Sutrauk ·
          Detaliau · Klausk…
        </p>

        <ArticlePageClient article={articleWithRelated} />
      </main>
    </div>
  );
}
