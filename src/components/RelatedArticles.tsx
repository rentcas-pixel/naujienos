import Link from "next/link";
import type { ReactNode } from "react";
import type { AlternativePerspective } from "@/lib/types";

interface RelatedArticlesProps {
  items: AlternativePerspective[];
}

function RelatedLink({
  item,
  children,
  className = "",
}: {
  item: AlternativePerspective;
  children: ReactNode;
  className?: string;
}) {
  if (item.slug) {
    return (
      <Link href={`/straipsnis/${item.slug}`} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

export function RelatedArticles({ items }: RelatedArticlesProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-bbc-border">
      <h2 className="text-xs font-bold uppercase tracking-wider text-bbc-red mb-6">
        Susijusios naujienos
      </h2>

      <div className="space-y-5">
        {items.map((item) => (
          <article
            key={item.slug ?? item.url}
            className="group pb-5 border-b border-bbc-border last:border-0 last:pb-0"
          >
            <p className="bbc-meta mb-1.5">{item.outlet}</p>
            <RelatedLink
              item={item}
              className="bbc-story-link block"
            >
              <h3 className="bbc-headline-sm text-bbc-black group-hover:text-bbc-red transition-colors">
                {item.headline}
              </h3>
            </RelatedLink>
            {item.excerpt && (
              <p className="mt-2 text-[15px] leading-snug text-bbc-gray line-clamp-2">
                {item.excerpt}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
