import type { Article, TopicAnglesPack } from "./types";
import type { SearchResult } from "./web-search";
import type { PublishSkipReason } from "./topic-angles-store";

/** Mažiausiai tiek skirtingų domenų iš paieškos */
export const MIN_SOURCE_DOMAINS = 2;
/** Mažiausiai tiek simbolių iš paieškos snippet’ų */
export const MIN_SEARCH_CHARS = 350;
/** Arba pakankamai turtinga pati RSS santrauka */
export const MIN_BODY_CHARS_RICH = 600;

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function uniqueSourceDomains(
  results: SearchResult[],
  originalUrl?: string
): string[] {
  const originalHost = originalUrl ? hostFromUrl(originalUrl) : "";
  const seen = new Set<string>();

  for (const result of results) {
    const host = hostFromUrl(result.url);
    if (!host) continue;
    if (originalHost && host === originalHost) continue;
    seen.add(host);
  }

  // Originalus portalas skaičiuojasi kaip 1 šaltinis, jei yra
  if (originalHost) seen.add(originalHost);

  return [...seen];
}

export function assessPublishQuality(
  article: Article,
  searchResults: SearchResult[]
): { ok: true } | { ok: false; reason: PublishSkipReason } {
  if (article.isPromotional) {
    return { ok: false, reason: "promotional" };
  }

  const bodyChars = article.paragraphs
    .map((paragraph) => paragraph.text)
    .join(" ")
    .trim().length;

  const domains = uniqueSourceDomains(searchResults, article.originalUrl);
  const searchChars = searchResults.reduce(
    (sum, result) => sum + (result.snippet?.length ?? 0),
    0
  );

  if (domains.length < MIN_SOURCE_DOMAINS) {
    return { ok: false, reason: "no_sources" };
  }

  const hasEnoughInfo =
    searchChars >= MIN_SEARCH_CHARS || bodyChars >= MIN_BODY_CHARS_RICH;

  if (!hasEnoughInfo) {
    return { ok: false, reason: "thin" };
  }

  return { ok: true };
}

/** Po generavimo — pakete turi būti bent N unikalių šaltinių URL. */
export function packHasEnoughSources(
  pack: TopicAnglesPack,
  minDomains = MIN_SOURCE_DOMAINS
): boolean {
  const hosts = new Set<string>();
  for (const angle of pack.angles) {
    for (const source of angle.sources) {
      const host = hostFromUrl(source.url);
      if (host) hosts.add(host);
    }
  }
  return hosts.size >= minDomains;
}
