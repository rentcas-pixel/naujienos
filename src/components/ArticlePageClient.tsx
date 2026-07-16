"use client";

import { useCallback, useState } from "react";
import type { Article, Source, TopicAnglesPack } from "@/lib/types";
import { ArticleView } from "./ArticleView";
import { ArticleFooter } from "./ArticleFooter";
import { RelatedArticles } from "./RelatedArticles";
import { TopicAngles } from "./TopicAngles";

interface ArticlePageClientProps {
  article: Article;
  topicAngles: TopicAnglesPack | null;
}

export function ArticlePageClient({
  article,
  topicAngles,
}: ArticlePageClientProps) {
  const [sources, setSources] = useState<Source[]>([]);

  const addSources = useCallback((incoming: Source[]) => {
    setSources((prev) => {
      const urls = new Set(prev.map((s) => s.url));
      const fresh = incoming.filter((s) => !urls.has(s.url));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  return (
    <>
      <ArticleView article={article} onAddSources={addSources} />
      {topicAngles && <TopicAngles pack={topicAngles} />}
      <RelatedArticles items={article.alternativePerspectives} />
      <ArticleFooter article={article} sources={sources} />
    </>
  );
}
