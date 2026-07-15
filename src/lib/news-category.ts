import type { NewsCategory } from "./rss-feeds";

const CATEGORY_RANK: Record<string, number> = {
  Lietuva: 1,
  Pasaulis: 3,
  Verslas: 3,
  Sportas: 3,
  Nepriklausomi: 4,
};

const URL_RULES: Array<{ category: NewsCategory; pattern: RegExp }> = [
  { category: "Pasaulis", pattern: /\/(pasaulis|pasaulyje|world|aktualu\/pasaulis)\b/i },
  { category: "Verslas", pattern: /\/(verslas|business|ekonomika)\b/i },
  { category: "Sportas", pattern: /\/(sportas|sport|futbolas|krepsinis)\b/i },
  {
    category: "Lietuva",
    pattern: /\/(lietuva|lietuvoje|lietuvosdiena|aktualu\/lietuva|naujienos\/lietuvoje)\b/i,
  },
];

const RSS_TAG_MAP: Array<{ category: NewsCategory; pattern: RegExp }> = [
  { category: "Pasaulis", pattern: /^(pasaulis|pasaulyje|world|užsienis|uzsienis)$/i },
  { category: "Lietuva", pattern: /^(lietuva|lietuvoje|lithuania)$/i },
  { category: "Verslas", pattern: /^(verslas|ekonomika|business)$/i },
  { category: "Sportas", pattern: /^(sportas|sportas\s*$|futbolas|krepšinis|krepsinis)$/i },
];

const FOREIGN_SIGNAL =
  /\b(ukrain|rusij|putin|zelensk|tramp|trump|baltarus|maskv|kinij|izrael|hamas|britanij|prancūzij|prancuzij|vokietij|lenkij|jav\b|openai|chatgpt|marine le pen|nato)\w*/i;

const LITHUANIA_SIGNAL =
  /\b(lietuv|vilni|kaun(?:as|e|o)\b|klaipėd|klaiped|šiauli|siauli|panevėž|panevez|seim(?:as|e|o)\b|ruginien|skvernel|turnišk|turnisk|marijampol)\w*/i;

function normalizeTag(tag: string): string {
  return tag.replace(/\s+/g, " ").trim();
}

export function categoryFromUrl(url: string): NewsCategory | undefined {
  try {
    const path = new URL(url).pathname;
    for (const rule of URL_RULES) {
      if (rule.pattern.test(path)) return rule.category;
    }
  } catch {
    for (const rule of URL_RULES) {
      if (rule.pattern.test(url)) return rule.category;
    }
  }
  return undefined;
}

export function categoryFromRssTags(
  tags: string[] | undefined
): NewsCategory | undefined {
  if (!tags?.length) return undefined;
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (!tag) continue;
    for (const rule of RSS_TAG_MAP) {
      if (rule.pattern.test(tag)) return rule.category;
    }
  }
  return undefined;
}

function looksForeignWithoutLithuaniaFocus(
  title: string,
  excerpt: string
): boolean {
  const text = `${title} ${excerpt}`;
  if (!FOREIGN_SIGNAL.test(text)) return false;
  if (LITHUANIA_SIGNAL.test(text)) return false;
  return true;
}

/**
 * Galutinė kategorija:
 * 1) Nepriklausomi feed'ai lieka Nepriklausomi
 * 2) URL kelias (15min/LRT/Lrytas skyriai)
 * 3) RSS <category> žyma
 * 4) Jei feed'as bendras „Lietuva“ — silpnas heuristikos signalas užsieniui
 * 5) Feed'o numatytoji kategorija
 */
export function resolveNewsCategory(input: {
  feedCategory: string;
  url: string;
  rssCategories?: string[];
  title?: string;
  excerpt?: string;
}): string {
  if (input.feedCategory === "Nepriklausomi") {
    return "Nepriklausomi";
  }

  const fromUrl = categoryFromUrl(input.url);
  if (fromUrl) return fromUrl;

  const fromTags = categoryFromRssTags(input.rssCategories);
  if (fromTags) return fromTags;

  if (
    input.feedCategory === "Lietuva" &&
    looksForeignWithoutLithuaniaFocus(input.title ?? "", input.excerpt ?? "")
  ) {
    return "Pasaulis";
  }

  return input.feedCategory;
}

/** Didesnis = labiau specifinė / pageidaujama kategorija dedupe metu */
export function categoryPreferenceScore(category: string): number {
  return CATEGORY_RANK[category] ?? 0;
}
