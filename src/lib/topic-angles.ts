import type {
  Article,
  TopicAngle,
  TopicAnglesPack,
  TopicAngleSource,
} from "./types";
import {
  buildTopicAnglesPrompt,
  buildTopicAnglesQaPrompt,
} from "./prompts";
import { getOpenAIModel } from "./openai-config";
import { searchWeb, type SearchResult } from "./web-search";
import { markPublishSkipped } from "./topic-angles-store";
import {
  assessPublishQuality,
  packHasEnoughSources,
} from "./article-publish-quality";

const MAX_ANGLES = 3;
const MAX_FACTS_PER_ANGLE = 5;

const BANNED_SECTION_LABELS =
  /^(kas nutiko|santrauka|esm[eė]|trumpai|apžvalga|straipsnio santrauka|kas įvyko)$/i;

const STOPWORDS = new Set([
  "yra",
  "buvo",
  "bus",
  "kad",
  "kai",
  "kaip",
  "arba",
  "bei",
  "su",
  "is",
  "iš",
  "i",
  "į",
  "apie",
  "per",
  "po",
  "iki",
  "nes",
  "tai",
  "to",
  "tos",
  "savo",
  "si",
  "ši",
  "sis",
  "šis",
  "labai",
  "daug",
  "jau",
  "dar",
  "tik",
  "vien",
  "vienas",
  "viena",
  "gali",
  "turi",
  "tarp",
]);

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Grubus LT kamieno sutrumpinimas overlap’ui. */
function stemToken(token: string): string {
  if (token.length <= 4) return token;
  return token
    .replace(
      /(avimui|avimo|avima|avimu|avime|avimas|avimui)$/,
      "av"
    )
    .replace(/(iniai|ines|inis|ine|iniu)$/, "")
    .replace(
      /(ams|uose|emis|emis|ui|iu|is|as|os|es|e|a|u|o|i|ų|ą|ę)$/,
      ""
    )
    .replace(/(iaus|iausiai)$/, "")
    .slice(0, 10);
}

function contentStems(text: string): string[] {
  return normalizeForCompare(text)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
    .map(stemToken)
    .filter((t) => t.length >= 3);
}

function hasConcreteDetail(fact: string): boolean {
  return (
    /\d/.test(fact) ||
    /\b(proc\.?|procent|km|m\b|mln|mlrd|tūkst|€|\$|kartų|kartus|siauriaus|anksčia|didžiausi|mažiausi|pirmą|vienintel|palyg|vs\.?)\b/i.test(
      fact
    )
  );
}

/** „X yra svarbus / strateginis Y“ be skaičių — ne įdomus faktas. */
export function isLowValueFact(fact: string): boolean {
  const norm = normalizeForCompare(fact);
  const words = norm.split(" ").filter(Boolean);
  if (words.length < 5) return true;

  const vagueImportance =
    /\b(svarb|strategisk|pagrindin|esmin|reiksming|gyvybisk|kritisk)/.test(
      norm
    ) &&
    /\b(yra|lieka|tapo|laikomas|laikoma)\b/.test(norm) &&
    !hasConcreteDetail(fact);

  if (vagueImportance) return true;

  // Bendrinės frazės be turinio
  if (
    /\b(turi didele itaka|sukelia stres|tarptautine bendruomene stebi|pasekmes dar nera aiskios|kelia nerima)\b/.test(
      norm
    )
  ) {
    return true;
  }

  return false;
}

/** Faktas kartoja straipsnį (pažodžiui, parafraze ar beveik). */
export function factRepeatsArticle(fact: string, articleText: string): boolean {
  if (isLowValueFact(fact)) return true;

  const factNorm = normalizeForCompare(fact);
  const articleNorm = normalizeForCompare(articleText);
  if (factNorm.length < 18) return true;
  if (articleNorm.length < 40) return false;

  if (articleNorm.includes(factNorm)) return true;

  // Ilgesnio fakto langai straipsnyje
  if (factNorm.length >= 28) {
    const window = Math.min(40, factNorm.length);
    for (let i = 0; i <= factNorm.length - window; i += 10) {
      const slice = factNorm.slice(i, i + window);
      if (articleNorm.includes(slice)) return true;
    }
  }

  const factStems = contentStems(fact);
  if (factStems.length === 0) return true;

  const articleStemSet = new Set(contentStems(articleText));
  let overlap = 0;
  for (const stem of factStems) {
    if (articleStemSet.has(stem)) overlap += 1;
  }
  const ratio = overlap / factStems.length;

  // Trumpa parafrazė („Hormūzas svarbus naftai“) — žemesnis slenkstis
  if (factStems.length <= 8 && ratio >= 0.5) return true;
  if (factStems.length <= 12 && ratio >= 0.62) return true;
  if (ratio >= 0.78) return true;

  return false;
}

function isBannedSectionLabel(label: string): boolean {
  return BANNED_SECTION_LABELS.test(label.trim());
}

function isInterestingFactsLabel(label: string): boolean {
  return /įdom|idom/i.test(label);
}

function filterAngleNovelty(
  angle: TopicAngle,
  articleText: string
): TopicAngle | null {
  if (isBannedSectionLabel(angle.label)) return null;

  const facts = angle.facts.filter((fact) => {
    if (factRepeatsArticle(fact, articleText)) return false;
    // „Įdomūs faktai“ — tik su konkrečiu skaičiumi / mastu / palyginimu
    if (isInterestingFactsLabel(angle.label) && !hasConcreteDetail(fact)) {
      return false;
    }
    return true;
  });
  if (facts.length === 0) return null;

  return { ...angle, facts };
}

function filterPackNovelty(
  angles: TopicAngle[],
  articleText: string
): TopicAngle[] {
  return angles
    .map((angle) => filterAngleNovelty(angle, articleText))
    .filter((angle): angle is TopicAngle => Boolean(angle))
    .slice(0, MAX_ANGLES);
}

function extractJsonPayload(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function outletFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "Šaltinis";
  }
}

function slugifyLabel(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || `skiltis-${index + 1}`;
}

function buildSearchQueries(title: string, category?: string): string[] {
  const base = title.replace(/[„“"']/g, "").trim().slice(0, 120);
  return [
    `${base} Lietuva`,
    `${base} kontekstas istorija`,
    category ? `${base} ${category}` : `${base} analizė faktų`,
  ];
}

async function gatherSearchResults(
  title: string,
  category?: string
): Promise<SearchResult[]> {
  const queries = buildSearchQueries(title, category);
  const batches = await Promise.all(queries.map((query) => searchWeb(query)));
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  for (const batch of batches) {
    for (const item of batch) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      merged.push(item);
      if (merged.length >= 12) return merged;
    }
  }

  return merged;
}

function formatResults(results: SearchResult[]): string {
  if (results.length === 0) return "";
  return results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.title}\nURL: ${result.url}\n${result.snippet}`
    )
    .join("\n\n");
}

function normalizeSource(
  raw: Partial<TopicAngleSource>,
  allowedUrls: Map<string, SearchResult>
): TopicAngleSource | null {
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const matched = allowedUrls.get(url);
  if (!matched && !url.startsWith("http")) return null;

  const headline =
    (typeof raw.headline === "string" && raw.headline.trim()) ||
    matched?.title ||
    "";
  if (!headline || !url) return null;

  return {
    outlet:
      (typeof raw.outlet === "string" && raw.outlet.trim()) ||
      outletFromUrl(url),
    headline,
    url: matched?.url ?? url,
    note:
      typeof raw.note === "string" && raw.note.trim()
        ? raw.note.trim().slice(0, 80)
        : undefined,
  };
}

function normalizeAngle(
  raw: Partial<TopicAngle> & { id?: string; label?: string },
  index: number,
  allowedUrls: Map<string, SearchResult>,
  usedIds: Set<string>
): TopicAngle | null {
  const label =
    typeof raw.label === "string" ? raw.label.trim().slice(0, 48) : "";
  if (!label) return null;

  const facts = (raw.facts ?? [])
    .map((f) => String(f).trim())
    .filter((f) => f.length > 12)
    .slice(0, MAX_FACTS_PER_ANGLE);

  if (facts.length === 0) return null;

  let id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40)
      : slugifyLabel(label, index);

  if (!id) id = `skiltis-${index + 1}`;
  if (usedIds.has(id)) id = `${id}-${index + 1}`;
  usedIds.add(id);

  const sources = (raw.sources ?? [])
    .map((s) => normalizeSource(s, allowedUrls))
    .filter((s): s is TopicAngleSource => Boolean(s))
    .slice(0, 4);

  return {
    id,
    label,
    lead: "",
    paragraphs: [],
    facts,
    sources,
  };
}

function parseAnglesPayload(
  raw: string,
  searchResults: SearchResult[],
  articleText: string
): { angles: TopicAngle[]; readerQuestions: string[] } {
  try {
    const parsed = JSON.parse(raw) as {
      angles?: Partial<TopicAngle>[];
      readerQuestions?: unknown[];
    };
    if (!Array.isArray(parsed.angles)) return { angles: [], readerQuestions: [] };

    const allowedUrls = new Map(
      searchResults.map((result) => [result.url, result])
    );
    const usedIds = new Set<string>();
    const angles: TopicAngle[] = [];

    for (let i = 0; i < parsed.angles.length && angles.length < MAX_ANGLES; i++) {
      const angle = normalizeAngle(parsed.angles[i], i, allowedUrls, usedIds);
      if (angle) angles.push(angle);
    }

    const readerQuestions = (parsed.readerQuestions ?? [])
      .map((q) => String(q).trim())
      .filter((q) => q.length > 8)
      .slice(0, 3);

    return {
      angles: filterPackNovelty(angles, articleText),
      readerQuestions,
    };
  } catch {
    return { angles: [], readerQuestions: [] };
  }
}

async function callOpenAIJson(
  system: string,
  user: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOpenAIModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function callOpenAITopicAngles(
  article: Article,
  searchContext: string
): Promise<string | null> {
  const articleText = article.paragraphs.map((p) => p.text).join("\n\n");
  const { system, user } = buildTopicAnglesPrompt(
    article.title,
    articleText,
    searchContext,
    article.source
  );
  return callOpenAIJson(system, user, { temperature: 0.35, maxTokens: 2800 });
}

/**
 * Antras AI žingsnis prieš publish: išmeta kartojimus / silpnus faktus.
 * Fail-closed: jei QA neatsako — nepublikuojam.
 */
async function qaTopicAnglesPack(
  article: Article,
  angles: TopicAngle[]
): Promise<{ ok: true; angles: TopicAngle[] } | { ok: false }> {
  const articleText = article.paragraphs.map((p) => p.text).join("\n\n");
  const anglesJson = JSON.stringify(
    angles.map((angle) => ({
      id: angle.id,
      label: angle.label,
      facts: angle.facts,
    }))
  );
  const { system, user } = buildTopicAnglesQaPrompt(
    article.title,
    articleText,
    anglesJson
  );

  const raw = await callOpenAIJson(system, user, {
    temperature: 0.1,
    maxTokens: 1600,
  });
  if (!raw) return { ok: false };

  try {
    const parsed = JSON.parse(extractJsonPayload(raw)) as {
      pass?: boolean;
      angles?: Array<{ id?: string; label?: string; facts?: unknown[] }>;
    };

    if (parsed.pass === false) return { ok: false };

    const byId = new Map(angles.map((angle) => [angle.id, angle]));
    const approved: TopicAngle[] = [];

    for (const item of parsed.angles ?? []) {
      const id = typeof item.id === "string" ? item.id : "";
      const original = byId.get(id);
      if (!original) continue;
      if (isBannedSectionLabel(item.label ?? original.label)) continue;

      const allowedFacts = new Set(
        original.facts.map((fact) => normalizeForCompare(fact))
      );
      const facts = (item.facts ?? [])
        .map((fact) => String(fact).trim())
        .filter(
          (fact) =>
            fact.length > 12 &&
            allowedFacts.has(normalizeForCompare(fact)) &&
            !factRepeatsArticle(fact, `${article.title}\n${articleText}`)
        )
        .slice(0, MAX_FACTS_PER_ANGLE);

      if (isInterestingFactsLabel(item.label ?? original.label)) {
        const concrete = facts.filter((fact) => hasConcreteDetail(fact));
        if (concrete.length === 0) continue;
        approved.push({ ...original, label: original.label, facts: concrete });
        continue;
      }

      if (facts.length === 0) continue;
      approved.push({ ...original, facts });
      if (approved.length >= MAX_ANGLES) break;
    }

    if (approved.length === 0) return { ok: false };
    return { ok: true, angles: approved };
  } catch {
    return { ok: false };
  }
}

/** Eksportuota prepare pipeline’ui (be disko write). */
export async function generateTopicAnglesPackForArticle(
  article: Article,
  options?: { markSkipped?: boolean }
): Promise<TopicAnglesPack | null> {
  return generateTopicAnglesPack(article, options);
}

async function generateTopicAnglesPack(
  article: Article,
  options?: { markSkipped?: boolean }
): Promise<TopicAnglesPack | null> {
  const markSkipped = options?.markSkipped !== false;
  const skip = async (reason: Parameters<typeof markPublishSkipped>[1]) => {
    if (markSkipped) await markPublishSkipped(article.slug, reason);
  };

  if (article.isPromotional) {
    await skip("promotional");
    return null;
  }
  if (!process.env.OPENAI_API_KEY) return null;

  const searchResults = await gatherSearchResults(
    article.title,
    article.category
  );

  const quality = assessPublishQuality(article, searchResults);
  if (!quality.ok) {
    await skip(quality.reason);
    return null;
  }

  const articleText = article.paragraphs.map((p) => p.text).join("\n\n");
  const searchContext = formatResults(searchResults);
  const raw = await callOpenAITopicAngles(article, searchContext);
  if (!raw) {
    await skip("generation_failed");
    return null;
  }

  const { angles, readerQuestions } = parseAnglesPayload(
    extractJsonPayload(raw),
    searchResults,
    `${article.title}\n${articleText}`
  );

  if (angles.length < 1) {
    await skip("thin");
    return null;
  }

  if (searchResults.length > 0) {
    const fallbackSources = searchResults.slice(0, 4).map((result) => ({
      outlet: outletFromUrl(result.url),
      headline: result.title,
      url: result.url,
    }));
    for (const angle of angles) {
      if (angle.sources.length === 0) {
        angle.sources = fallbackSources;
      }
    }
  }

  const qa = await qaTopicAnglesPack(article, angles);
  if (!qa.ok) {
    await skip("qa_failed");
    return null;
  }

  const pack: TopicAnglesPack = {
    angles: qa.angles,
    generatedAt: new Date().toISOString(),
    readerQuestions:
      readerQuestions.length > 0 ? readerQuestions : undefined,
  };

  if (!packHasEnoughSources(pack)) {
    await skip("no_sources");
    return null;
  }

  return pack;
}

export async function getTopicAnglesForSlug(
  slug: string
): Promise<TopicAnglesPack | null> {
  if (!slug) return null;
  try {
    const { readPreparedPublish } = await import("./topic-angles-store");
    const prepared = await readPreparedPublish(slug);
    if (prepared?.pack) return prepared.pack;

    const { prepareArticleForPublish } = await import("./prepare-article");
    const result = await prepareArticleForPublish(slug);
    return result?.pack ?? null;
  } catch {
    return null;
  }
}

/** Fone: pilnas prepare (antraštė + tekstas + Kitu kampu + QA). */
export async function warmTopicAnglesForSlugs(
  slugs: string[],
  limit = 5
): Promise<void> {
  const { readPreparedPublish, getPublishSkipReason } = await import(
    "./topic-angles-store"
  );
  const { prepareArticleForPublish } = await import("./prepare-article");
  const unique = [...new Set(slugs)].slice(0, limit);
  for (const slug of unique) {
    try {
      if (await readPreparedPublish(slug)) continue;
      if ((await getPublishSkipReason(slug)) === "promotional") continue;
      await prepareArticleForPublish(slug);
    } catch (err) {
      console.error("[warm] prepare failed", slug, err);
    }
  }
}
