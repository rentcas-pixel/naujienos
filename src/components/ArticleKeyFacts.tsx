import type { ReactNode } from "react";

interface ArticleKeyFactsProps {
  count: number;
  renderParagraph: (index: number) => ReactNode;
}

export function ArticleKeyFacts({ count, renderParagraph }: ArticleKeyFactsProps) {
  if (count === 0) return null;

  return (
    <section className="article-key-facts mb-8 pb-8 border-b border-bbc-border">
      <p className="text-xs font-bold uppercase tracking-wider text-bbc-red mb-4">
        Svarbiausi faktai
      </p>
      <div className="article-key-facts__body">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="article-key-facts__line">
            {renderParagraph(index)}
          </div>
        ))}
      </div>
    </section>
  );
}
