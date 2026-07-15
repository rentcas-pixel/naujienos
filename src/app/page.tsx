import { SiteHeader } from "@/components/SiteHeader";
import { NewsHome } from "@/components/NewsHome";
import { getLatestNews, getHomepageWithSections } from "@/lib/news";
import { paramToCategory, paramToNavTab } from "@/lib/rss-feeds";

export const revalidate = 900;

interface HomeProps {
  searchParams: Promise<{ kategorija?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { kategorija } = await searchParams;
  const category = paramToCategory(kategorija);
  const pageTitle = paramToNavTab(kategorija);

  if (!category) {
    const { todayNews, displayNews, categorySections } =
      await getHomepageWithSections();

    return (
      <div className="min-h-screen bg-white">
        <SiteHeader activeCategory={kategorija} />

        <main className="max-w-[1280px] mx-auto px-4 py-6">
          {todayNews.length === 0 && displayNews.length > 0 && (
            <div className="bg-bbc-bg-soft border-l-4 border-bbc-red px-4 py-3 mb-6 text-sm text-bbc-gray">
              Šiandienos naujienų kol kas mažai — rodomos naujausios.
            </div>
          )}

          <NewsHome
            items={displayNews}
            pageTitle={pageTitle}
            showCategorySections
            categorySections={categorySections}
          />
        </main>

        <footer className="bg-bbc-black text-white mt-8">
          <div className="max-w-[1280px] mx-auto px-4 py-8">
            <p className="text-[13px] text-[#b0b0b0] text-center">
              Naujienos agreguojamos iš viešų RSS šaltinių · Atnaujinama kas 15
              min.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  const news = await getLatestNews({
    category,
    todayOnly: true,
    limit: 40,
  });

  const displayNews =
    news.length >= 8 ? news : await getLatestNews({ category, limit: 40 });

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader activeCategory={kategorija} />

      <main className="max-w-[1280px] mx-auto px-4 py-6">
        {news.length === 0 && displayNews.length > 0 && (
          <div className="bg-bbc-bg-soft border-l-4 border-bbc-red px-4 py-3 mb-6 text-sm text-bbc-gray">
            Šiandienos naujienų kol kas mažai — rodomos naujausios.
          </div>
        )}

        <NewsHome
          items={displayNews}
          pageTitle={pageTitle}
          showCategorySections={false}
        />
      </main>

      <footer className="bg-bbc-black text-white mt-8">
        <div className="max-w-[1280px] mx-auto px-4 py-8">
          <p className="text-[13px] text-[#b0b0b0] text-center">
            Naujienos agreguojamos iš viešų RSS šaltinių · Atnaujinama kas 15
            min.
          </p>
        </div>
      </footer>
    </div>
  );
}
