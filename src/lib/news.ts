import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import type { Article, ArticleParagraph } from "./types";
import { LT_RSS_FEEDS, NEWS_CATEGORIES, type NewsCategory } from "./rss-feeds";
import { fetchRssFeed, type RssItem } from "./rss-client";
import {
  estimateReadingTime,
  formatRelativeTime,
  formatLrtDateTime,
  isToday,
  stripHtml,
} from "./html-utils";
import { articles as staticArticles } from "./articles";
import { findRelatedHeadlinesFromCandidates } from "./related-headlines";
import { isPromotionalContent } from "./promotional-content";
import {
  heuristicDeclickbait,
  editHeadlinesForDisplay,
  translateSingleEnHeadline,
  applyEnExcerptToParagraphs,
} from "./headline-transform";

interface RawNewsItem {
  slug: string;
  title: string;
  excerpt: string;
  source: string;
  sourceId: string;
  category: string;
  originalUrl: string;
  publishedDate: string;
  paragraphs: ArticleParagraph[];
  imageUrl?: string;
  isPromotional: boolean;
  language: "lt" | "en";
}

function slugFromUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemRichness(item: RawNewsItem): number {
  let score = 0;
  if (item.imageUrl) score += 100;
  score += item.excerpt.length;
  score += item.paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0);
  return score;
}

function pickPreferredDuplicate(a: RawNewsItem, b: RawNewsItem): RawNewsItem {
  const scoreA = itemRichness(a);
  const scoreB = itemRichness(b);
  if (scoreA !== scoreB) return scoreA > scoreB ? a : b;

  return new Date(a.publishedDate) >= new Date(b.publishedDate) ? a : b;
}

function dedupeNewsItems(items: RawNewsItem[]): RawNewsItem[] {
  const bySlug = new Map<string, RawNewsItem>();
  for (const item of items) {
    const existing = bySlug.get(item.slug);
    if (!existing) {
      bySlug.set(item.slug, item);
    } else {
      bySlug.set(item.slug, pickPreferredDuplicate(existing, item));
    }
  }

  const byTitle = new Map<string, RawNewsItem>();
  for (const item of bySlug.values()) {
    const key = normalizeTitle(item.title);
    if (!key) continue;

    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, item);
    } else {
      byTitle.set(key, pickPreferredDuplicate(existing, item));
    }
  }

  return Array.from(byTitle.values()).sort(
    (a, b) =>
      new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
  );
}

function textToParagraphs(text: string): ArticleParagraph[] {
  if (!text.trim()) {
    return [{ id: "p0", text: "Turinys nepasiekiamas — skaitykite originalą." }];
  }

  const chunks = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (chunks.length === 0) {
    return [{ id: "p0", text }];
  }

  const paragraphs: string[] = [];
  for (let i = 0; i < chunks.length; i += 2) {
    paragraphs.push(chunks.slice(i, i + 2).join(" "));
  }

  return paragraphs.map((t, i) => ({ id: `p${i}`, text: t }));
}

function extractImageFromItem(item: RssItem): string | undefined {
  if (item.enclosure?.url?.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
    return item.enclosure.url;
  }

  const mediaContent = item["media:content"];
  const mediaItems = Array.isArray(mediaContent)
    ? mediaContent
    : mediaContent
      ? [mediaContent]
      : [];

  for (const media of mediaItems) {
    const mediaUrl = media?.["@_url"];
    if (mediaUrl?.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
      return mediaUrl;
    }
  }

  const html = item.content || item.contentSnippet || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match?.[1]) {
    const src = match[1];
    if (src.startsWith("http")) return src;
  }

  return undefined;
}

const MIN_CONTENT_LENGTH = 80;

function itemToRaw(
  item: RssItem,
  feed: (typeof LT_RSS_FEEDS)[number]
): RawNewsItem | null {
  const link = item.link || item.guid;
  if (!link || !item.title) return null;

  const pubDate = item.pubDate || item.published || item.updated;
  const publishedDate = pubDate ? new Date(pubDate) : new Date();
  const rawContent =
    item.contentSnippet ||
    item.content ||
    item.summary ||
    item.description ||
    "";

  let cleanText = stripHtml(rawContent);
  if (cleanText.length < MIN_CONTENT_LENGTH) {
    const titleText = stripHtml(item.title || "");
    if (titleText.length >= 20) {
      cleanText = titleText;
    } else {
      return null;
    }
  }

  const excerpt = cleanText.slice(0, 220) + (cleanText.length > 220 ? "…" : "");
  const titleText = stripHtml(item.title);

  return {
    slug: slugFromUrl(link),
    title: titleText,
    excerpt,
    source: feed.name,
    sourceId: feed.id,
    category: feed.category,
    originalUrl: link,
    publishedDate: publishedDate.toISOString(),
    paragraphs: textToParagraphs(cleanText),
    imageUrl: extractImageFromItem(item),
    isPromotional: isPromotionalContent(titleText, cleanText),
    language: feed.language ?? "lt",
  };
}

async function fetchRssNewsOnly(): Promise<RawNewsItem[]> {
  const results = await Promise.allSettled(
    LT_RSS_FEEDS.map(async (feed) => {
      const parsed = await fetchRssFeed(feed.url);
      return parsed.items
        .map((item) => itemToRaw(item, feed))
        .filter((item): item is RawNewsItem => item !== null);
    })
  );

  const all: RawNewsItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      all.push(...result.value);
    }
  }

  return dedupeNewsItems(
    all.map((item) => ({
      ...item,
      title: heuristicDeclickbait(item.title),
    }))
  );
}

const getCachedRssNews = unstable_cache(fetchRssNewsOnly, ["rss-news-v11"], {
  revalidate: 900,
});

async function editRawItems(
  items: RawNewsItem[],
  options?: { budgetMs?: number; maxItems?: number }
): Promise<RawNewsItem[]> {
  if (items.length === 0) return items;

  const withIds = items.map((item) => ({
    ...item,
    id: item.slug,
  }));
  const edited = await editHeadlinesForDisplay(withIds, options);
  const bySlug = new Map(edited.map((item) => [item.slug, item]));

  return items.map((item) => {
    const updated = bySlug.get(item.slug);
    if (!updated) return item;
    return applyEnExcerptToParagraphs({
      ...item,
      title: updated.title,
      excerpt: updated.excerpt || item.excerpt,
    });
  });
}

async function enrichRawWithEditedHeadlines(
  all: RawNewsItem[],
  subset: RawNewsItem[],
  options?: { budgetMs?: number; maxItems?: number }
): Promise<RawNewsItem[]> {
  const edited = await editRawItems(subset, options);
  const bySlug = new Map(edited.map((item) => [item.slug, item]));
  return all.map((item) => bySlug.get(item.slug) ?? item);
}

function filterRawOnly(
  items: RawNewsItem[],
  options?: {
    sourceId?: string;
    category?: string;
    todayOnly?: boolean;
    limit?: number;
  }
): RawNewsItem[] {
  let filtered = items;

  if (options?.sourceId) {
    filtered = filtered.filter((item) => item.sourceId === options.sourceId);
  }

  if (options?.category) {
    filtered = filtered.filter((item) => item.category === options.category);
  }

  if (options?.todayOnly) {
    filtered = filtered.filter((item) =>
      isToday(new Date(item.publishedDate))
    );
  }

  const limit = options?.limit ?? 80;
  return filtered.slice(0, limit);
}

function rawToListItem(item: RawNewsItem): NewsListItem {
  const publishedDate = new Date(item.publishedDate);
  return {
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    source: item.source,
    sourceId: item.sourceId,
    category: item.category,
    publishedAt: formatRelativeTime(publishedDate),
    publishedLabel: formatLrtDateTime(publishedDate),
    isToday: isToday(publishedDate),
    imageUrl: item.imageUrl,
  };
}

function filterRawItems(
  items: RawNewsItem[],
  options?: {
    sourceId?: string;
    category?: string;
    todayOnly?: boolean;
    limit?: number;
  }
): NewsListItem[] {
  return filterRawOnly(items, options).map(rawToListItem);
}

function rawToArticle(raw: RawNewsItem): Article {
  const fullText = raw.paragraphs.map((p) => p.text).join(" ");
  const publishedDate = new Date(raw.publishedDate);
  return {
    slug: raw.slug,
    title: raw.title,
    category: raw.category,
    publishedAt: formatRelativeTime(publishedDate),
    readingTime: estimateReadingTime(fullText),
    paragraphs: raw.paragraphs,
    timeline: [],
    alternativePerspectives: [],
    source: raw.source,
    originalUrl: raw.originalUrl,
    publishedDate,
    imageUrl: raw.imageUrl,
    isPromotional: raw.isPromotional,
  };
}

export interface NewsListItem {
  slug: string;
  title: string;
  excerpt: string;
  source: string;
  sourceId: string;
  category: string;
  publishedAt: string;
  publishedLabel: string;
  isToday: boolean;
  imageUrl?: string;
}

export async function getLatestNews(options?: {
  sourceId?: string;
  category?: string;
  todayOnly?: boolean;
  limit?: number;
}): Promise<NewsListItem[]> {
  const raw = await getCachedRssNews();

  let filtered = filterRawOnly(raw, {
    sourceId: options?.sourceId,
    category: options?.category,
    todayOnly: options?.todayOnly,
    limit: options?.limit ?? 80,
  });

  filtered = await editRawItems(filtered, { budgetMs: 4000, maxItems: 16 });

  return filtered.map(rawToListItem);
}

export async function getHomepageWithSections(): Promise<{
  todayNews: NewsListItem[];
  displayNews: NewsListItem[];
  categorySections: Array<{ category: NewsCategory; items: NewsListItem[] }>;
}> {
  const raw = await getCachedRssNews();

  const todayItems = filterRawOnly(raw, { todayOnly: true, limit: 40 });
  const displayItems =
    todayItems.length >= 8 ? todayItems : filterRawOnly(raw, { limit: 40 });
  const sectionItems = NEWS_CATEGORIES.flatMap((cat) =>
    filterRawOnly(raw, { category: cat, limit: 4 })
  );

  const slugSet = new Set(
    [...displayItems, ...sectionItems].map((item) => item.slug)
  );
  const toEdit = raw.filter((item) => slugSet.has(item.slug));
  // Hard budget — puslapis neturi kabėti ant OpenAI
  const enriched = await enrichRawWithEditedHeadlines(raw, toEdit, {
    budgetMs: 3500,
    maxItems: 12,
  });

  const todayNews = filterRawItems(enriched, { todayOnly: true, limit: 40 });
  const displayNews =
    todayNews.length >= 8 ? todayNews : filterRawItems(enriched, { limit: 40 });

  const categorySections = NEWS_CATEGORIES.map((cat) => ({
    category: cat,
    items: filterRawItems(enriched, { category: cat, limit: 4 }),
  })).filter((section) => section.items.length > 0);

  return { todayNews, displayNews, categorySections };
}

export async function getNewsArticleBySlug(
  slug: string
): Promise<Article | undefined> {
  const raw = await getCachedRssNews();
  let item = raw.find((n) => n.slug === slug);
  if (!item) return undefined;

  const edited = await translateSingleEnHeadline(
    item.title,
    item.excerpt,
    item.language
  );
  if (edited) {
    item = applyEnExcerptToParagraphs({
      ...item,
      title: edited.title,
      excerpt: edited.excerpt || item.excerpt,
    });
  }

  return rawToArticle(item);
}

export async function getArticleBySlug(
  slug: string
): Promise<Article | undefined> {
  if (staticArticles[slug]) return staticArticles[slug];
  return getNewsArticleBySlug(slug);
}

export async function findRelatedHeadlines(
  options: {
    title: string;
    excerpt?: string;
    relatedTopics?: string[];
    excludeSlug: string;
    currentSource?: string;
  },
  limit = 3
): Promise<Article["alternativePerspectives"]> {
  const raw = await getCachedRssNews();
  return findRelatedHeadlinesFromCandidates(options, raw, limit);
}
