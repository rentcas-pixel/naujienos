import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleBySlug, findRelatedHeadlines } from "@/lib/news";
import { prepareArticleForReading } from "@/lib/expand-article";
import { prepareArticleForPublish } from "@/lib/prepare-article";
import {
  hasTopicAnglesPack,
  isArticlePublishable,
  isPublishSkipped,
  readPreparedPublish,
} from "@/lib/topic-angles-store";
import { SiteHeader } from "@/components/SiteHeader";
import { ArticlePageClient } from "@/components/ArticlePageClient";

export const revalidate = 900;
export const maxDuration = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const baseArticle = await getArticleBySlug(slug);

  if (!baseArticle) notFound();

  const publishable = await isArticlePublishable(slug);
  let prepared = await readPreparedPublish(slug);
  let topicAngles = prepared?.pack ?? null;

  // Naujas straipsnis: kol nėra pilnai paruošta — nerodom turinio
  if (!publishable) {
    if (await isPublishSkipped(slug)) {
      return (
        <div className="min-h-screen bg-white">
          <SiteHeader />
          <main className="max-w-[720px] mx-auto px-4 py-24 text-center">
            <p className="text-sm text-bbc-black font-medium">
              Šios temos kol kas nepublikuojame
            </p>
            <p className="mt-2 text-sm text-bbc-gray max-w-md mx-auto">
              Per mažai nepriklausomų šaltinių arba informacijos, kad būtų
              solidus straipsnis — nerodome „tuščio“ AI teksto.
            </p>
            {baseArticle.originalUrl && (
              <p className="mt-4">
                <Link
                  href={baseArticle.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bbc-red font-semibold hover:underline text-sm"
                >
                  Skaityti originalų šaltinį →
                </Link>
              </p>
            )}
            <p className="bbc-meta mt-6">
              <Link href="/" className="text-bbc-red hover:underline">
                ← Grįžti į naujienas
              </Link>
            </p>
          </main>
        </div>
      );
    }

    const result = await prepareArticleForPublish(slug);
    prepared = result
      ? {
          slug,
          title: result.article.title,
          excerpt: "",
          article: result.article,
          pack: result.pack,
        }
      : null;
    topicAngles = prepared?.pack ?? null;

    if (!prepared || !(await hasTopicAnglesPack(slug))) {
      const skippedAfterAttempt = await isPublishSkipped(slug);
      return (
        <div className="min-h-screen bg-white">
          <SiteHeader />
          <main className="max-w-[720px] mx-auto px-4 py-24 text-center">
            {skippedAfterAttempt ? (
              <>
                <p className="text-sm text-bbc-black font-medium">
                  Šios temos kol kas nepublikuojame
                </p>
                <p className="mt-2 text-sm text-bbc-gray max-w-md mx-auto">
                  Surinkta per mažai šaltinių / info — straipsnis feed’e
                  nepasirodys.
                </p>
                {baseArticle.originalUrl && (
                  <p className="mt-4">
                    <Link
                      href={baseArticle.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bbc-red font-semibold hover:underline text-sm"
                    >
                      Skaityti originalų šaltinį →
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-bbc-red border-r-transparent" />
                <p className="mt-4 text-sm text-bbc-black font-medium">
                  Straipsnis dar ruošiamas
                </p>
                <p className="mt-1 text-sm text-bbc-gray">
                  AI ruošia antraštę, tekstą ir „Kitu kampu“. Pasirodys feed’e,
                  kai viskas bus paruošta.
                </p>
              </>
            )}
            <p className="bbc-meta mt-6">
              <Link href="/" className="text-bbc-red hover:underline">
                ← Grįžti į naujienas
              </Link>
            </p>
          </main>
        </div>
      );
    }
  }

  const article = prepared?.article
    ? prepared.article
    : await prepareArticleForReading(baseArticle);

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
          Pažymėkite tekstą — desktop’e iš karto generuojamas „Detaliau“,
          telefone — trumpa veiksmų juosta (Paaiškink · Sutrauk · Detaliau ·
          Klausk…).
        </p>

        <ArticlePageClient
          article={articleWithRelated}
          topicAngles={topicAngles}
        />
      </main>
    </div>
  );
}
