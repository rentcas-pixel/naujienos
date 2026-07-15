import Link from "next/link";
import type { NewsListItem } from "@/lib/news";
import { NEWS_CATEGORIES, categoryToParam, type NewsCategory } from "@/lib/rss-feeds";

interface NewsHomeProps {
  items: NewsListItem[];
  pageTitle?: string;
  showCategorySections?: boolean;
  categorySections?: Array<{ category: NewsCategory; items: NewsListItem[] }>;
  trendingLabels?: string[];
}

function MetaLine({ item }: { item: NewsListItem }) {
  return (
    <p className="bbc-meta mt-2">
      {item.isTrending && (
        <>
          <span className="text-bbc-red font-bold">Tendencija</span>
          <span className="bbc-meta__dot">|</span>
        </>
      )}
      <span>{item.publishedAt}</span>
      <span className="bbc-meta__dot">|</span>
      <span>{item.category}</span>
    </p>
  );
}

function Headline({
  item,
  size = "md",
  className = "",
}: {
  item: NewsListItem;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}) {
  const sizeClass =
    size === "hero"
      ? "bbc-headline-hero"
      : size === "lg"
        ? "bbc-headline-lg"
        : size === "sm"
          ? "bbc-headline-sm"
          : "bbc-headline-md";

  return (
    <h2 className={`${sizeClass} text-bbc-black ${className}`}>{item.title}</h2>
  );
}

function ArticleImage({ item }: { item: NewsListItem }) {
  return (
    <div className="relative aspect-video bg-bbc-bg-soft overflow-hidden">
      {item.imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-[#ececec]" />
      )}
    </div>
  );
}

function TopStories({ hero, sidebar }: { hero: NewsListItem; sidebar: NewsListItem[] }) {
  return (
    <section className="grid lg:grid-cols-12 gap-6 mb-8 pb-8 border-b border-bbc-border">
      <article className="lg:col-span-8">
        <Link href={`/straipsnis/${hero.slug}`} className="bbc-story-link block">
          <ArticleImage item={hero} />
          <h2 className="bbc-headline-hero text-bbc-black mt-5">{hero.title}</h2>
          {hero.excerpt && (
            <p className="mt-3 text-[16px] leading-relaxed text-bbc-gray line-clamp-3">
              {hero.excerpt}
            </p>
          )}
          <MetaLine item={hero} />
        </Link>
      </article>

      <div className="lg:col-span-4 flex flex-col divide-y divide-bbc-border">
        {sidebar.map((item) => (
          <article key={item.slug} className="py-4 first:pt-0 last:pb-0">
            <Link href={`/straipsnis/${item.slug}`} className="bbc-story-link block">
              <Headline item={item} size="md" />
              {item.excerpt && (
                <p className="mt-2 text-[15px] leading-snug text-bbc-gray line-clamp-2">
                  {item.excerpt}
                </p>
              )}
              <MetaLine item={item} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function PromoGrid({ items }: { items: NewsListItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 pb-8 border-b border-bbc-border">
      {items.map((item) => (
        <article key={item.slug}>
          <Link href={`/straipsnis/${item.slug}`} className="bbc-story-link block">
            <ArticleImage item={item} />
            <Headline item={item} size="lg" className="mt-5" />
            <MetaLine item={item} />
          </Link>
        </article>
      ))}
    </section>
  );
}

function CategorySection({
  category,
  items,
}: {
  category: NewsCategory;
  items: NewsListItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-10 pb-8 border-b border-bbc-border last:border-0">
      <Link href={`/?kategorija=${categoryToParam(category)}`}>
        <h2 className="bbc-section-title">{category}</h2>
      </Link>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.slice(0, 4).map((item) => (
          <article key={item.slug}>
            <Link href={`/straipsnis/${item.slug}`} className="bbc-story-link block">
              <ArticleImage item={item} />
              <Headline item={item} size="sm" className="mt-5" />
              <MetaLine item={item} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function MostRead({ items }: { items: NewsListItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="bbc-section-title">Populiariausios</h2>
      <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
        {items.slice(0, 10).map((item, index) => (
          <li key={item.slug} className="flex gap-3 items-start">
            <span className="text-[32px] font-bold leading-none text-bbc-red shrink-0 w-8">
              {index + 1}
            </span>
            <div>
              <Link
                href={`/straipsnis/${item.slug}`}
                className="bbc-story-link text-[16px] font-bold leading-snug text-bbc-black"
              >
                {item.title}
              </Link>
              <p className="bbc-meta mt-1">{item.publishedAt}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function NewsHome({
  items,
  pageTitle = "Naujausios",
  showCategorySections = true,
  categorySections,
  trendingLabels = [],
}: NewsHomeProps) {
  if (items.length === 0) {
    return (
      <p className="text-center text-bbc-gray py-20 text-sm">
        Naujienų nerasta. Bandykite vėliau.
      </p>
    );
  }

  const hero = items[0];
  const sidebar = items.slice(1, 6);
  const promo = items.slice(6, 9);

  const sections =
    categorySections ??
    NEWS_CATEGORIES.map((category) => ({
      category,
      items: items.filter((item) => item.category === category).slice(0, 4),
    })).filter((group) => group.items.length > 0);

  return (
    <div>
      <h1 className="bbc-page-title">{pageTitle}</h1>

      {trendingLabels.length > 0 && (
        <div className="mb-6 pb-4 border-b border-bbc-border">
          <p className="text-[12px] font-bold uppercase tracking-wide text-bbc-gray mb-2">
            Dabar aktualu
          </p>
          <div className="flex flex-wrap gap-2">
            {trendingLabels.map((label) => (
              <span key={label} className="bbc-ai-chip">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {hero && sidebar.length > 0 && <TopStories hero={hero} sidebar={sidebar} />}
      <PromoGrid items={promo} />

      {showCategorySections &&
        sections.map(({ category, items: categoryItems }) => (
          <CategorySection key={category} category={category} items={categoryItems} />
        ))}

      <MostRead items={items} />
    </div>
  );
}
