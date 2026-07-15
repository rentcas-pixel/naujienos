export interface RssFeedConfig {
  id: string;
  name: string;
  url: string;
  category: string;
  /** Kalba antraštėms — EN šaltiniai verčiami į LT */
  language?: "lt" | "en";
}

/** RSS šaltiniai, kurie dalijasi straipsnio santrauka ar turiniu */
export const LT_RSS_FEEDS: RssFeedConfig[] = [
  // Lietuva
  {
    id: "delfi-lietuva",
    name: "Delfi",
    url: "https://www.delfi.lt/rss/feeds/lithuania.xml",
    category: "Lietuva",
  },
  { id: "15min", name: "15min", url: "https://www.15min.lt/rss", category: "Lietuva" },
  { id: "lrt", name: "LRT", url: "https://www.lrt.lt/?rss", category: "Lietuva" },
  { id: "lrytas", name: "Lrytas", url: "https://www.lrytas.lt/rss/", category: "Lietuva" },
  { id: "diena", name: "Diena.lt", url: "https://www.diena.lt/rss", category: "Lietuva" },
  {
    id: "kauno-diena",
    name: "Kauno diena",
    url: "https://www.kauno.diena.lt/rss",
    category: "Lietuva",
  },
  {
    id: "bernardinai",
    name: "Bernardinai",
    url: "https://www.bernardinai.lt/feed",
    category: "Lietuva",
  },

  // Pasaulis
  {
    id: "delfi-pasaulis",
    name: "Delfi",
    url: "https://www.delfi.lt/rss/feeds/world.xml",
    category: "Pasaulis",
  },
  {
    id: "15min-pasaulis",
    name: "15min",
    url: "https://www.15min.lt/rss/pasaulis",
    category: "Pasaulis",
  },

  // Verslas
  {
    id: "15min-verslas",
    name: "15min",
    url: "https://www.15min.lt/rss/verslas",
    category: "Verslas",
  },
  { id: "vz", name: "Verslo žinios", url: "https://www.vz.lt/rss", category: "Verslas" },

  // Sportas
  {
    id: "15min-sportas",
    name: "15min",
    url: "https://www.15min.lt/rss/sportas",
    category: "Sportas",
  },

  // Nepriklausomi
  {
    id: "radikaliai",
    name: "Radikaliai",
    url: "https://www.radikaliai.lt/rss",
    category: "Nepriklausomi",
  },
  {
    id: "malinauskas",
    name: "Skirmantas Malinauskas",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC-AGx7rM_mBqesECSVp-x8w",
    category: "Nepriklausomi",
  },
  {
    id: "propublica",
    name: "ProPublica",
    url: "https://www.propublica.org/feeds/propublica/main",
    category: "Nepriklausomi",
    language: "en",
  },
  {
    id: "intercept",
    name: "The Intercept",
    url: "https://theintercept.com/feed/?lang=en",
    category: "Nepriklausomi",
    language: "en",
  },
  {
    id: "bellingcat",
    name: "Bellingcat",
    url: "https://www.bellingcat.com/feed/",
    category: "Nepriklausomi",
    language: "en",
  },
  {
    id: "restofworld",
    name: "Rest of World",
    url: "https://restofworld.org/feed/latest",
    category: "Nepriklausomi",
    language: "en",
  },
  {
    id: "greenwald",
    name: "Glenn Greenwald",
    url: "https://greenwald.substack.com/feed",
    category: "Nepriklausomi",
    language: "en",
  },
  {
    id: "hc-richardson",
    name: "Heather Cox Richardson",
    url: "https://heathercoxrichardson.substack.com/feed",
    category: "Nepriklausomi",
    language: "en",
  },
  {
    id: "matt-stoller",
    name: "Matt Stoller",
    url: "https://mattstoller.substack.com/feed",
    category: "Nepriklausomi",
    language: "en",
  },
];

export const NEWS_CATEGORIES = [
  "Lietuva",
  "Pasaulis",
  "Verslas",
  "Sportas",
  "Nepriklausomi",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NAV_TABS = ["Naujausios", ...NEWS_CATEGORIES] as const;

export type NavTab = (typeof NAV_TABS)[number];

export const SOURCE_COLORS: Record<string, string> = {
  Delfi: "text-blue-700 bg-blue-50",
  "15min": "text-orange-700 bg-orange-50",
  LRT: "text-red-700 bg-red-50",
  Lrytas: "text-yellow-800 bg-yellow-50",
  "Verslo žinios": "text-indigo-700 bg-indigo-50",
  Bernardinai: "text-green-700 bg-green-50",
  "Diena.lt": "text-teal-700 bg-teal-50",
  "Kauno diena": "text-cyan-700 bg-cyan-50",
  Radikaliai: "text-rose-700 bg-rose-50",
  "Skirmantas Malinauskas": "text-red-800 bg-red-50",
  ProPublica: "text-amber-800 bg-amber-50",
  "The Intercept": "text-slate-700 bg-slate-100",
  Bellingcat: "text-sky-800 bg-sky-50",
  "Rest of World": "text-violet-700 bg-violet-50",
  "Glenn Greenwald": "text-stone-700 bg-stone-100",
  "Heather Cox Richardson": "text-indigo-800 bg-indigo-50",
  "Matt Stoller": "text-orange-800 bg-orange-50",
};

export function getSourceColor(name: string): string {
  return SOURCE_COLORS[name] ?? "text-gray-700 bg-gray-100";
}

export function categoryToParam(category: NewsCategory): string {
  return category.toLowerCase();
}

export function paramToCategory(param?: string): NewsCategory | undefined {
  if (!param || param.toLowerCase() === "naujausios") return undefined;
  return NEWS_CATEGORIES.find(
    (c) => c.toLowerCase() === param.toLowerCase()
  );
}

export function paramToNavTab(param?: string): NavTab {
  const category = paramToCategory(param);
  return category ?? "Naujausios";
}

export function navTabToHref(tab: NavTab): string {
  if (tab === "Naujausios") return "/";
  return `/?kategorija=${categoryToParam(tab)}`;
}
