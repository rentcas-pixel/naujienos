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
export const maxDuration = 60;

interface HomeProps {
  searchParams: Promise<{ kategorija?: string }>;
}

function scheduleTopicAngleWarm(pendingSlugs: string[]) {
  if (pendingSlugs.length === 0) return;
  after(async () => {
    await warmTopicAnglesForSlugs(pendingSlugs, 8);
    revalidatePath("/");
  });
}

export default async function Home({ searchParams }: HomeProps) {
  const { kategorija } = await searchParams;
  const category = paramToCategory(kategorija);
  const pageTitle = paramToNavTab(kategorija);

  if (!category) {
    let {
      todayNews,
      displayNews,
      categorySections,
      pendingSlugs,
    } = await getHomepageWithSections();

    // Jei feed tuščias, bet yra pending — paruošiam bent 1 dabar (ne tik fone)
    if (displayNews.length === 0 && pendingSlugs.length > 0) {
      await warmTopicAnglesForSlugs(pendingSlugs, 1);
      ({
        todayNews,
        displayNews,
        categorySections,
        pendingSlugs,
      } = await getHomepageWithSections());
    }

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

          {displayNews.length === 0 && pendingSlugs.length > 0 && (
            <div className="bg-bbc-bg-soft border-l-4 border-bbc-red px-4 py-3 mb-6 text-sm text-bbc-gray">
              AI ruošia straipsnius ({pendingSlugs.length} eilėje). Perkraukite
              po minutės.
            </div>
          )}

          <NewsHome
            items={displayNews}
            pageTitle={pageTitle}
            showCategorySections
            categorySections={categorySections}
            preparing={displayNews.length === 0 && pendingSlugs.length > 0}
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

  // Kategorija: warm iš visų pending (ne tik „šiandien“), kitaip eilė būna 0
  const pendingPool = await getLatestNewsWithPending({
    category,
    todayOnly: false,
    limit: 60,
  });

  let { items: news } = await getLatestNewsWithPending({
    category,
    todayOnly: true,
    limit: 40,
  });

  let displayNews =
    news.length >= 8
      ? news
      : (await getLatestNewsWithPending({ category, limit: 40 })).items;

  if (displayNews.length === 0 && pendingPool.pendingSlugs.length > 0) {
    await warmTopicAnglesForSlugs(pendingPool.pendingSlugs, 1);
    displayNews = (
      await getLatestNewsWithPending({ category, limit: 40 })
    ).items;
    news = (
      await getLatestNewsWithPending({
        category,
        todayOnly: true,
        limit: 40,
      })
    ).items;
  }

  scheduleTopicAngleWarm(pendingPool.pendingSlugs);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader activeCategory={kategorija} />

      <main className="max-w-[1280px] mx-auto px-4 py-6">
        {news.length === 0 && displayNews.length > 0 && (
          <div className="bg-bbc-bg-soft border-l-4 border-bbc-red px-4 py-3 mb-6 text-sm text-bbc-gray">
            Šiandienos naujienų kol kas mažai — rodomos naujausios.
          </div>
        )}

        {displayNews.length === 0 && pendingPool.pendingSlugs.length > 0 && (
          <div className="bg-bbc-bg-soft border-l-4 border-bbc-red px-4 py-3 mb-6 text-sm text-bbc-gray">
            AI ruošia straipsnius ({pendingPool.pendingSlugs.length} eilėje).
            Perkraukite po minutės.
          </div>
        )}

        <NewsHome
          items={displayNews}
          pageTitle={pageTitle}
          showCategorySections={false}
          preparing={
            displayNews.length === 0 && pendingPool.pendingSlugs.length > 0
          }
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
