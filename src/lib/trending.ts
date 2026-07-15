import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import { fetchRssFeed } from "./rss-client";
import { stripHtml } from "./html-utils";

export interface TrendingTopic {
  label: string;
  region: "lt" | "world";
  keywords: string[];
}

export interface TrendingSnapshot {
  topics: TrendingTopic[];
  fetchedAt: string;
}

const GOOGLE_NEWS_LT =
  "https://news.google.com/rss?hl=lt&gl=LT&ceid=LT:lt";
const GOOGLE_NEWS_WORLD =
  "https://news.google.com/rss/headlines/section/topic/WORLD?hl=lt&gl=LT&ceid=LT:lt";

const STOP_WORDS = new Set(
  [
    "ir",
    "bei",
    "ar",
    "o",
    "kad",
    "kaip",
    "del",
    "dėl",
    "su",
    "is",
    "iš",
    "i",
    "į",
    "apie",
    "po",
    "iki",
    "per",
    "nes",
    "tai",
    "si",
    "šį",
    "sia",
    "šia",
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "after",
    "before",
    "says",
    "said",
    "new",
    "news",
    "naujien",
    "lietuv",
    "metu",
    "metų",
  ].map((w) => w.toLowerCase())
);

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9ąčęėįšųūž]/gi, "");
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function cleanHeadline(raw: string): string {
  // Google News: "Title - Source"
  return stripHtml(raw)
    .replace(/\s+[-–—]\s+[^-–—]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function topicFromHeadline(
  headline: string,
  region: "lt" | "world"
): TrendingTopic | null {
  const label = cleanHeadline(headline);
  if (label.length < 12) return null;
  const keywords = [...new Set(tokenize(label))].slice(0, 8);
  if (keywords.length === 0) return null;
  return { label: label.slice(0, 110), region, keywords };
}

async function loadRegionHeadlines(
  url: string,
  region: "lt" | "world"
): Promise<TrendingTopic[]> {
  try {
    const feed = await fetchRssFeed(url);
    const topics: TrendingTopic[] = [];
    for (const item of feed.items.slice(0, 18)) {
      const title = item.title;
      if (!title) continue;
      const topic = topicFromHeadline(title, region);
      if (topic) topics.push(topic);
    }
    return topics;
  } catch {
    return [];
  }
}

async function fetchTrendingSnapshot(): Promise<TrendingSnapshot> {
  const [lt, world] = await Promise.all([
    loadRegionHeadlines(GOOGLE_NEWS_LT, "lt"),
    loadRegionHeadlines(GOOGLE_NEWS_WORLD, "world"),
  ]);

  // Dedupuoti panašias temas pagal keyword overlap
  const merged = [...lt.slice(0, 12), ...world.slice(0, 12)];
  const unique: TrendingTopic[] = [];

  for (const topic of merged) {
    const isDup = unique.some((existing) => {
      const shared = topic.keywords.filter((k) =>
        existing.keywords.includes(k)
      ).length;
      return shared >= 2;
    });
    if (!isDup) unique.push(topic);
  }

  return {
    topics: unique.slice(0, 20),
    fetchedAt: new Date().toISOString(),
  };
}

const getCachedTrending = unstable_cache(
  async () => fetchTrendingSnapshot(),
  ["trending-topics-v1"],
  { revalidate: 1800 }
);

export async function getTrendingSnapshot(): Promise<TrendingSnapshot> {
  try {
    return await getCachedTrending();
  } catch {
    return { topics: [], fetchedAt: new Date().toISOString() };
  }
}

export interface TrendScored<T> {
  item: T;
  score: number;
  matchedTopics: string[];
}

export function scoreAgainstTrends(
  title: string,
  excerpt: string,
  category: string,
  snapshot: TrendingSnapshot
): { score: number; matchedTopics: string[] } {
  if (snapshot.topics.length === 0) {
    return { score: 0, matchedTopics: [] };
  }

  const haystack = tokenize(`${title} ${excerpt.slice(0, 240)}`);
  if (haystack.length === 0) return { score: 0, matchedTopics: [] };

  const hayset = new Set(haystack);
  let best = 0;
  const matchedTopics: string[] = [];

  for (const topic of snapshot.topics) {
    const hits = topic.keywords.filter((k) => hayset.has(k)).length;
    if (hits === 0) continue;

    let score = hits * 12;
    // Bonus jei sutampa regionas / kategorija
    if (topic.region === "lt" && category === "Lietuva") score += 8;
    if (topic.region === "world" && category === "Pasaulis") score += 8;
    if (hits >= 2) score += 10;
    if (hits >= 3) score += 12;

    if (score > best) best = score;
    if (hits >= 2 || score >= 20) {
      matchedTopics.push(topic.label);
    }
  }

  return {
    score: best,
    matchedTopics: [...new Set(matchedTopics)].slice(0, 2),
  };
}

export function rankByTrending<
  T extends {
    title: string;
    excerpt: string;
    category: string;
    publishedAt?: string;
    publishedDate?: string | Date;
  },
>(items: T[], snapshot: TrendingSnapshot): Array<T & { isTrending?: boolean }> {
  const now = Date.now();

  const scored = items.map((item) => {
    const { score: trendScore, matchedTopics } = scoreAgainstTrends(
      item.title,
      item.excerpt,
      item.category,
      snapshot
    );

    const publishedRaw =
      item.publishedDate instanceof Date
        ? item.publishedDate.getTime()
        : item.publishedDate
          ? new Date(item.publishedDate).getTime()
          : now;
    const ageHours = Math.max(0, (now - publishedRaw) / 3_600_000);
    const freshness = Math.max(0, 24 - ageHours); // 0–24

    const total = trendScore * 3 + freshness;

    return {
      item,
      total,
      trendScore,
      matchedTopics,
    };
  });

  scored.sort((a, b) => b.total - a.total);

  return scored.map(({ item, trendScore }) => ({
    ...item,
    isTrending: trendScore >= 20,
  }));
}

export function trendingFingerprint(snapshot: TrendingSnapshot): string {
  return createHash("sha256")
    .update(snapshot.topics.map((t) => t.label).join("|"))
    .digest("hex")
    .slice(0, 12);
}
