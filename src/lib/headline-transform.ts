import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import type { ArticleParagraph } from "./types";
import {
  buildHeadlineEditorSystemPrompt,
  buildHeadlineEditorUserPrompt,
} from "./prompts";

export interface HeadlineInput {
  id: string;
  title: string;
  excerpt: string;
  language: "lt" | "en";
  publishedDate?: string;
}

export interface HeadlineOutput {
  title: string;
  excerpt: string;
  insufficientInfo?: boolean;
}

const MAX_AI_BATCH = 12;
const DEFAULT_LIST_BUDGET_MS = 3500;

const INSUFFICIENT_MARKER = "Straipsnyje trūksta informacijos kokybiškai antraštei.";

const CONCRETE_PLACE =
  /\b(?:Lietuv(?:a|oje|os)|Vilni(?:us|uje|aus)|Kaun(?:as|e|o)|Klaipėd(?:a|oje|os)|Šiauli(?:ai|uose|ų)|Panevėž(?:ys|yje|io)|Eur(?:opa|oje|os)|Baltij(?:a|oje|os)|Ukrain(?:a|oje|os)|Rusij(?:a|oje|os)|JAV|Jungtin(?:ės|ėse)|Lenkij(?:a|oje|os)|Vokietij(?:a|oje|os)|Prancūzij(?:a|oje|os)|Švedij(?:a|oje|os)|Latvij(?:a|oje|os)|Estij(?:a|oje|os)|Aliask(?:a|oje)|Pabaltij(?:ys|yje)|NATO|ES|Briusel(?:is|yje)|Maskv(?:a|oje)|Kyjiv(?:as|e)|Varšuv(?:a|oje))\b/i;

const CONCRETE_INSTITUTION =
  /\b(?:Seim(?:as|e|o)|Vyriausyb(?:ė|ėje|ės)|ministr(?:as|ė|ai)|prezident(?:as|ė)|teism(?:as|e|o)|policij(?:a|oje)|STT|FNTT|VMI|Sodra|NATO|Europos Komisij(?:a|oje)|Tribunol(?:as|e)|savivaldyb(?:ė|ėje)|partij(?:a|oje)|prokuratūr(?:a|oje))\b/i;

const CONCRETE_TIME =
  /\b(?:\d{1,2}[-./]\d{1,2}|\d{4}\s*m\.?|šiandien|vakar|rytoj|šią\s+(?:savaitę|naktį)|šį\s+(?:mėnesį|rytą)|šiais\s+metais|praėjusi(?:ą|ąją)|sausi(?:o|ų)|vasari(?:o|ų)|kov(?:o|ą)|balandži(?:o|ų)|geguž(?:ės|ę)|birželi(?:o|ų)|liep(?:os|ą)|rugpjūči(?:o|ų)|rugsėj(?:o|į)|spali(?:o|ų)|lapkriči(?:o|ų)|gruodži(?:o|ų))\b/i;

const CONCRETE_CONSEQUENCE =
  /\b(?:mirė|žuvo|sužeist|uždraud|patais|išaug|sumažėj|pakil|krito|nusprend|patvirtin|atmest|areštu|nuteist|išrink|pasitrauk|užsidar|atidar|įvedė|panaikin|rekord|pirmą kartą|pateikė|pareikalav|įspėj|padidino|sumažino)\w*/i;

/** Antraštėje turi būti bent: vieta, laikas, skaičius, asmuo, institucija arba pasekmė. */
export function hasConcreteFact(title: string): boolean {
  const t = normalizeSpaces(title);
  if (!t) return false;

  if (/\d/.test(t)) return true;
  if (CONCRETE_PLACE.test(t)) return true;
  if (CONCRETE_INSTITUTION.test(t)) return true;
  if (CONCRETE_TIME.test(t)) return true;
  if (CONCRETE_CONSEQUENCE.test(t)) return true;

  // Tikrinis vardas / pavardė: bent 2 žodžiai su didžiąja (asmuo) LT diacritics OK
  const properTokens = t.match(
    /(?<![A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž])[A-ZĄČĘĖĮŠŲŪŽ][a-ząčęėįšųūž]{2,}(?:\s+[A-ZĄČĘĖĮŠŲŪŽ][a-ząčęėįšųūž]{2,})+/g
  );
  if (properTokens && properTokens.length > 0) return true;

  return false;
}

function withInsufficientMarker(excerpt: string): string {
  const clean = normalizeSpaces(excerpt);
  if (clean.startsWith(INSUFFICIENT_MARKER)) return clean;
  return clean ? `${INSUFFICIENT_MARKER} ${clean}` : INSUFFICIENT_MARKER;
}

function sanitizeHeadlineOutput(
  originalTitle: string,
  output: HeadlineOutput,
  excerpt = ""
): HeadlineOutput {
  const title = normalizeSpaces(output.title);
  const outExcerpt = normalizeSpaces(output.excerpt);
  const sourceExcerpt = outExcerpt || excerpt;

  const strong =
    isStrongHeadline(title) &&
    !isClickbaitTitle(title) &&
    !isLikelyEnglish(title);

  const insufficientFlag = output.insufficientInfo === true;

  if (strong && !insufficientFlag) {
    return { title, excerpt: outExcerpt, insufficientInfo: false };
  }

  const fromExcerpt = buildTitleFromExcerpt(sourceExcerpt);
  const fallback = fallbackHeadline(originalTitle, sourceExcerpt);

  const candidates = [fromExcerpt, fallback, title]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeSpaces(value))
    .filter(
      (value) =>
        !isLikelyEnglish(value) &&
        !isClickbaitTitle(value) &&
        isStrongHeadline(value)
    );

  if (candidates[0]) {
    return {
      title: candidates[0],
      excerpt: outExcerpt || sourceExcerpt,
      insufficientInfo: false,
    };
  }

  const bestEffort = [fallback, fromExcerpt, heuristicDeclickbait(originalTitle)]
    .filter((value): value is string => Boolean(value))
    .find((value) => !isLikelyEnglish(value));

  return {
    title: bestEffort || heuristicDeclickbait(originalTitle),
    excerpt: withInsufficientMarker(outExcerpt || sourceExcerpt),
    insufficientInfo: true,
  };
}

const LT_DIACRITICS = /[ąčęėįšųūž]/i;

const EN_WORD =
  /\b(the|and|for|with|from|this|that|will|has|have|was|were|about|into|after|before|says|said|new|how|why|what|when|who|their|they|them|your|you|are|not|but|can|all|one|out|our|over|some|time|very|just|now|only|also|back|been|being|could|would|should|where|while|which|world|report|investigation|exclusive|breaking)\b/i;

const CLICKBAIT_PHRASES = [
  /nepatikėsite/i,
  /štai kas nutiko/i,
  /internetas ūžia/i,
  /visi kalba apie/i,
  /pribloškė/i,
  /šokiravo/i,
  /sukėlė audrą/i,
  /liksite nustebę/i,
  /pagaliau paaiškėjo/i,
  /tai pakeis viską/i,
  /vos nesibaigė tragedija/i,
  /net sunku patikėti/i,
  /ką svarbu žinoti/i,
  /reakcijų audr/i,
  /išprotėjus/i,
  /kaip elgtis/i,
  /ką reikia žinoti/i,
  /internautai be pagrindo/i,
  /internautai.*ieško/i,
  /you won't believe/i,
  /everyone is talking/i,
  /shocking/i,
  /goes viral/i,
];

const CLICKBAIT_PREFIX =
  /^(?:breaking|exclusive|watch|live|update|urgent|alert|shocking|just in|developing|reklama|video|foto|nuotrauka|specialus projektas|sensacija|skandalingas|skandalinga|netikėtai|šokiruojantis|šokiruojanti|ką reikia žinoti|ką svarbu žinoti|štai kas|štai kodėl|ar žinojote|sužinokite|nepatikėsite|neįtikėtina|skaitomiausia|populiariausia|kodėl)\s*[:\-–—]?\s*/i;

const WEAK_SUBTITLE =
  /^(?:ką (?:svarbu|reikia) žinoti|internautai|kodėl|štai|sužinokite|viskas, ką|be pagrindo|kaip elgtis)/i;

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function fixAllCapsWords(title: string): string {
  return title.replace(/\b([A-ZÁ-Ž]{3,})\b/g, (word) => {
    if (word === word.toUpperCase() && word.length > 4) {
      return word.charAt(0) + word.slice(1).toLowerCase();
    }
    return word;
  });
}

export function isLikelyEnglish(text: string): boolean {
  if (LT_DIACRITICS.test(text)) return false;
  const letters = text.replace(/[^A-Za-zÀ-ž]/g, "");
  if (letters.length < 8) return false;
  return EN_WORD.test(text);
}

export function isClickbaitTitle(title: string): boolean {
  const normalized = title.trim();
  if (!normalized) return false;

  if (CLICKBAIT_PREFIX.test(normalized)) return true;
  if (CLICKBAIT_PHRASES.some((pattern) => pattern.test(normalized))) return true;
  if (/!{2,}/.test(normalized)) return true;
  if (/\?\s*$/.test(normalized) && normalized.split(/\s+/).length <= 14) return true;

  const colonParts = normalized.split(/[:–—]/);
  if (colonParts.length >= 2) {
    const subtitle = colonParts.slice(1).join(" ").trim();
    if (WEAK_SUBTITLE.test(subtitle)) return true;
    if (/ką (?:svarbu|reikia) žinoti/i.test(subtitle)) return true;
  }

  return false;
}

function firstExcerptSentence(excerpt: string): string {
  return normalizeSpaces(excerpt.split(/(?<=[.!?…])\s+/)[0] ?? excerpt).slice(0, 160);
}

function buildTitleFromExcerpt(excerpt: string): string | null {
  const sentence = firstExcerptSentence(excerpt);
  if (sentence.length < 24 || sentence.length > 150) return null;
  if (isClickbaitTitle(sentence)) return null;
  if (!hasConcreteFact(sentence)) return null;
  return sentence.replace(/[.!?…]+$/, "").trim();
}

export function isTooVagueHeadline(title: string): boolean {
  const words = normalizeSpaces(title).split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  if (normalizeSpaces(title).length < 28) return true;
  return !hasConcreteFact(title);
}

export function isAcceptableHeadline(title: string): boolean {
  const normalized = normalizeSpaces(title);
  if (normalized.length < 12) return false;
  if (isClickbaitTitle(normalized)) return false;
  if (isLikelyEnglish(normalized)) return false;
  return true;
}

export function isStrongHeadline(title: string): boolean {
  return isAcceptableHeadline(title) && !isTooVagueHeadline(title);
}

function fallbackHeadline(original: string, excerpt = ""): string {
  let result = heuristicDeclickbait(original);

  // „Lead: ką svarbu žinoti apie Topic“ → „Topic: Lead“ (jei Lead turi faktą) arba ištrauka
  const aboutMatch = result.match(
    /^(.*?)\s*[:–—]\s*ką (?:svarbu|reikia) žinoti apie\s+(.+)$/i
  );
  if (aboutMatch) {
    const lead = aboutMatch[1].trim();
    const topic = aboutMatch[2].replace(/[?.!]+$/, "").trim();
    if (topic) {
      const topicTitle = topic.charAt(0).toUpperCase() + topic.slice(1);
      result =
        lead && !isTooVagueHeadline(`${topicTitle} — ${lead}`)
          ? `${topicTitle}: ${lead.charAt(0).toLowerCase()}${lead.slice(1)}`
          : topicTitle;
    }
  } else {
    const colonMatch = result.match(/^([^:–—]+)\s*[:–—]\s*(.+)$/);
    if (colonMatch) {
      const [, lead, subtitle] = colonMatch;
      if (
        WEAK_SUBTITLE.test(subtitle.trim()) ||
        isClickbaitTitle(subtitle.trim())
      ) {
        result = lead.trim();
      }
    }
  }

  result = normalizeSpaces(result);

  if (isTooVagueHeadline(result) || isLikelyEnglish(result)) {
    const fromExcerpt = buildTitleFromExcerpt(excerpt);
    if (fromExcerpt) return fromExcerpt;
  }

  return result;
}

export function heuristicDeclickbait(title: string): string {
  let result = normalizeSpaces(title);
  result = result.replace(CLICKBAIT_PREFIX, "");
  result = result.replace(/!+/g, ".");
  result = result.replace(/\?+\s*$/, "");
  result = result.replace(/\s*[|–—-]\s*(?:video|foto|nuotraukos|galerija|apklausa)\s*$/i, "");
  result = fixAllCapsWords(result);
  return normalizeSpaces(result);
}

function headlineModel(): string {
  return process.env.OPENAI_HEADLINE_MODEL || "gpt-4o-mini";
}

function titleHash(title: string, excerpt: string): string {
  return createHash("sha256").update(`${title}\n${excerpt}`).digest("hex").slice(0, 16);
}

function needsEditorPass(item: HeadlineInput, titleAfterHeuristic: string): boolean {
  if (item.language === "en" || isLikelyEnglish(titleAfterHeuristic)) return true;
  if (isClickbaitTitle(item.title) || isClickbaitTitle(titleAfterHeuristic)) return true;
  // Dvi dalys su dvitaškiu – dažnas clickbait formatas LT portaluose
  if (/[:–—]/.test(titleAfterHeuristic)) return true;
  return false;
}

async function callHeadlineTransformBatch(
  items: HeadlineInput[]
): Promise<Map<string, HeadlineOutput>> {
  const apiKey = process.env.OPENAI_API_KEY;
  const results = new Map<string, HeadlineOutput>();
  if (!apiKey || items.length === 0) return results;

  const payload = items.map((item) => ({
    id: item.id,
    title: item.title,
    excerpt: item.excerpt.slice(0, 480),
    task:
      item.language === "en" || isLikelyEnglish(item.title)
        ? ("translate" as const)
        : ("rewrite" as const),
  }));

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: headlineModel(),
        messages: [
          { role: "system", content: buildHeadlineEditorSystemPrompt() },
          { role: "user", content: buildHeadlineEditorUserPrompt(payload) },
        ],
        temperature: 0.15,
        max_tokens: 3600,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return results;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return results;

    const parsed = JSON.parse(content) as {
      items?: Array<{
        id?: string;
        title?: string;
        excerpt?: string;
        insufficientInfo?: boolean;
      }>;
    };

    for (const entry of parsed.items ?? []) {
      if (!entry.id || !entry.title) continue;
      const originalItem = items.find((item) => item.id === entry.id);
      const sanitized = sanitizeHeadlineOutput(
        originalItem?.title ?? entry.title,
        {
          title: normalizeSpaces(entry.title),
          excerpt: normalizeSpaces(entry.excerpt ?? ""),
          insufficientInfo: entry.insufficientInfo === true,
        },
        originalItem?.excerpt ?? ""
      );
      results.set(entry.id, sanitized);
    }

    // Tik EN likučiai — vienas greitas vertimo kvietimas
    const stillEnglish = items.filter((item) => {
      const out = results.get(item.id);
      const title = out?.title ?? item.title;
      return item.language === "en" || isLikelyEnglish(title);
    });

    if (stillEnglish.length > 0) {
      const forced = await forceTranslateEnHeadlines(stillEnglish);
      for (const [id, output] of forced) {
        results.set(id, output);
      }
    }
  } catch {
    return results;
  }

  return results;
}

async function forceTranslateEnHeadlines(
  items: HeadlineInput[]
): Promise<Map<string, HeadlineOutput>> {
  const apiKey = process.env.OPENAI_API_KEY;
  const map = new Map<string, HeadlineOutput>();
  if (!apiKey || items.length === 0) return map;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: headlineModel(),
        messages: [
          {
            role: "system",
            content: `Išversk naujienų antraštes į lietuvių kalbą. Tik lietuvių kalba. Be clickbait. Su konkrečiu faktu (vieta, asmuo, skaičius ar pasekmė). Grąžink JSON: {"items":[{"id":"...","title":"...","excerpt":"..."}]}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              items: items.map((item) => ({
                id: item.id,
                title: item.title,
                excerpt: item.excerpt.slice(0, 400),
              })),
            }),
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return map;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return map;

    const parsed = JSON.parse(content) as {
      items?: Array<{ id?: string; title?: string; excerpt?: string }>;
    };

    for (const entry of parsed.items ?? []) {
      if (!entry.id || !entry.title) continue;
      if (isLikelyEnglish(entry.title)) continue;
      const original = items.find((item) => item.id === entry.id);
      map.set(
        entry.id,
        sanitizeHeadlineOutput(
          original?.title ?? entry.title,
          {
            title: normalizeSpaces(entry.title),
            excerpt: normalizeSpaces(entry.excerpt ?? ""),
          },
          original?.excerpt ?? ""
        )
      );
    }
  } catch {
    return map;
  }

  return map;
}

const getCachedHeadlineBatch = unstable_cache(
  async (_fingerprint: string, payloadJson: string) => {
    const items = JSON.parse(payloadJson) as HeadlineInput[];
    const map = await callHeadlineTransformBatch(items);
    return Object.fromEntries(map);
  },
  ["headline-editor-v10"],
  { revalidate: 604800 }
);

function applyLocalHeadline<T extends HeadlineInput>(item: T): T {
  const title = fallbackHeadline(item.title, item.excerpt);
  return {
    ...item,
    title,
    excerpt: isStrongHeadline(title)
      ? item.excerpt
      : withInsufficientMarker(item.excerpt),
  };
}

async function raceBudget<T>(
  promise: Promise<T>,
  budgetMs: number
): Promise<{ value: T | null; timedOut: boolean }> {
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    return { value: await promise, timedOut: false };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      promise.then((result) => ({ ok: true as const, result })),
      new Promise<{ ok: false }>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false }), budgetMs);
      }),
    ]);

    if (value.ok) return { value: value.result, timedOut: false };
    // AI tęsia fone — cache užpildys sekančiam užkrovimui
    void promise.catch(() => undefined);
    return { value: null, timedOut: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function editHeadlineChunk(
  chunk: HeadlineInput[]
): Promise<Map<string, HeadlineOutput>> {
  const fingerprint = createHash("sha256")
    .update(chunk.map((item) => titleHash(item.title, item.excerpt)).join("|"))
    .digest("hex")
    .slice(0, 20);

  const cached = await getCachedHeadlineBatch(
    fingerprint,
    JSON.stringify(
      chunk.map((item) => ({
        id: item.id,
        title: item.title,
        excerpt: item.excerpt,
        language: item.language,
      }))
    )
  );

  return new Map(Object.entries(cached));
}

export interface EditHeadlinesOptions {
  /** Maks. laukimo laikas ms. 0 = neriboti. Default list: 3500. */
  budgetMs?: number;
  /** Kiek daugiausia antraščių siųsti AI per request. */
  maxItems?: number;
}

/** Redaguoja antraštes pagal redaktoriaus promptą — VISOS skiltys. */
export async function editHeadlinesForDisplay<T extends HeadlineInput>(
  items: T[],
  options: EditHeadlinesOptions = {}
): Promise<T[]> {
  const budgetMs = options.budgetMs ?? DEFAULT_LIST_BUDGET_MS;
  const maxItems = options.maxItems ?? MAX_AI_BATCH;

  if (!process.env.OPENAI_API_KEY || items.length === 0) {
    return items.map((item) => applyLocalHeadline(item));
  }

  const prepared = items.map((item) => ({
    ...item,
    title: heuristicDeclickbait(item.title),
  }));

  const priority = prepared
    .filter((item) => needsEditorPass(item, item.title) || isTooVagueHeadline(item.title))
    .sort((a, b) => {
      const score = (item: HeadlineInput) => {
        let s = 0;
        if (item.language === "en" || isLikelyEnglish(item.title)) s += 100;
        if (isClickbaitTitle(item.title)) s += 50;
        if (isTooVagueHeadline(item.title)) s += 30;
        return s;
      };
      return score(b) - score(a);
    })
    .slice(0, maxItems);

  if (priority.length === 0) {
    return prepared.map((item) =>
      isStrongHeadline(item.title) ? item : applyLocalHeadline(item)
    );
  }

  const editPromise = (async () => {
    const map = new Map<string, HeadlineOutput>();
    for (let i = 0; i < priority.length; i += MAX_AI_BATCH) {
      const chunk = priority.slice(i, i + MAX_AI_BATCH);
      const chunkResults = await editHeadlineChunk(chunk);
      for (const [id, output] of chunkResults) {
        map.set(id, output);
      }
    }
    return map;
  })();

  const { value: aiResults } = await raceBudget(editPromise, budgetMs);

  return prepared.map((item) => {
    const ai = aiResults?.get(item.id);
    if (ai?.title) {
      return {
        ...item,
        title: ai.title,
        excerpt: ai.excerpt || item.excerpt,
      };
    }
    return applyLocalHeadline(item);
  });
}

export async function translateEnHeadlines<T extends HeadlineInput>(
  items: T[]
): Promise<T[]> {
  if (!process.env.OPENAI_API_KEY) return items;

  const prepared = items.map((item) => ({
    ...item,
    title: heuristicDeclickbait(item.title),
  }));

  const candidates = prepared
    .filter((item) => needsEditorPass(item, item.title))
    .sort(
      (a, b) =>
        new Date(b.publishedDate ?? 0).getTime() -
        new Date(a.publishedDate ?? 0).getTime()
    )
    .slice(0, MAX_AI_BATCH);

  if (candidates.length === 0) return prepared;

  const fingerprint = createHash("sha256")
    .update(candidates.map((item) => titleHash(item.title, item.excerpt)).join("|"))
    .digest("hex")
    .slice(0, 20);

  const cached = await getCachedHeadlineBatch(
    fingerprint,
    JSON.stringify(
      candidates.map((item) => ({
        id: item.id,
        title: item.title,
        excerpt: item.excerpt,
        language: item.language,
      }))
    )
  );

  const aiResults = new Map<string, HeadlineOutput>(Object.entries(cached));

  return prepared.map((item) => {
    const ai = aiResults.get(item.id);
    if (!ai) return item;

    return {
      ...item,
      title: ai.title || item.title,
      excerpt: ai.excerpt || item.excerpt,
    };
  });
}

const getCachedSingleHeadline = unstable_cache(
  async (_hash: string, title: string, excerpt: string, language: "lt" | "en") => {
    const map = await callHeadlineTransformBatch([
      { id: "single", title, excerpt, language },
    ]);
    return map.get("single") ?? null;
  },
  ["headline-editor-single-v5"],
  { revalidate: 604800 }
);

export async function translateSingleEnHeadline(
  title: string,
  excerpt: string,
  language: "lt" | "en" = "en"
): Promise<HeadlineOutput | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const hash = titleHash(title, excerpt);
  const cleaned = heuristicDeclickbait(title);
  const result = await getCachedSingleHeadline(hash, cleaned, excerpt, language);
  if (!result) return null;

  return sanitizeHeadlineOutput(title, result);
}

export function applyEnExcerptToParagraphs<
  T extends { language: "lt" | "en"; excerpt: string; paragraphs: ArticleParagraph[] },
>(item: T): T {
  if (item.language !== "en" || item.paragraphs.length === 0 || !item.excerpt) {
    return item;
  }

  const paragraphs = [...item.paragraphs];
  paragraphs[0] = { ...paragraphs[0], text: item.excerpt };
  return { ...item, paragraphs };
}
