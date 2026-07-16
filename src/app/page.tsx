import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { SiteHeader } from "@/components/SiteHeader";
import { NewsHome } from "@/components/NewsHome";
import {
  getLatestNewsWithPending,
  getHomepageWithSections,
} from "@/lib/news";
import { warmTopicAnglesForSlugs } from "@/lib/topic-angles";
import { paramToCategory, paramToNavTab } from "@/lib/rss-feeds";

export const revalidate = 900;

interface HomeProps {
  searchParams: Promise<{ kategorija?: string }>;
}

function scheduleTopicAngleWarm(pendingSlugs: string[]) {
  if (pendingSlugs.length === 0) return;
  after(async () => {
    await warmTopicAnglesForSlugs(pendingSlugs, 5);
    revalidatePath("/");
  });
}

export default async function Home({ searchParams }: HomeProps) {
  const { kategorija } = await searchParams;
  const category = paramToCategory(kategorija);
  const pageTitle = paramToNavTab(kategorija);

  if (!category) {
    const {
      todayNews,
      displayNews,
      categorySections,
      pendingSlugs,
    } = await getHomepageWithSections();

    if (pendingSlugs.length > 0) {
      scheduleTopicAngleWarm(pendingSlugs);
    }

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
              Naujienos agreguojamos iš viešų RSS šaltinių · Rūšiuojama pagal
              aktualumą · Atnaujinama kas 15 min.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  const { items: news, pendingSlugs } = await getLatestNewsWithPending({
    category,
    todayOnly: true,
    limit: 40,
  });

  const displayNews =
    news.length >= 8
      ? news
      : (await getLatestNewsWithPending({ category, limit: 40 })).items;

  scheduleTopicAngleWarm(pendingSlugs);

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
