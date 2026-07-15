"use client";

import { useCallback, useState } from "react";
import type { Article, Source } from "@/lib/types";
import { ArticleView } from "./ArticleView";
import { ArticleFooter } from "./ArticleFooter";
import { RelatedArticles } from "./RelatedArticles";

interface ArticlePageClientProps {
  article: Article;
}

export function ArticlePageClient({ article }: ArticlePageClientProps) {
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
      <RelatedArticles items={article.alternativePerspectives} />
      <ArticleFooter article={article} sources={sources} />
    </>
  );
}
