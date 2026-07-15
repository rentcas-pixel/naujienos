import type { AlternativePerspective } from "./types";

const LT_STOP_WORDS = new Set([
  "ir",
  "bei",
  "kad",
  "nes",
  "su",
  "po",
  "iš",
  "į",
  "ar",
  "yra",
  "buvo",
  "bus",
  "per",
  "dėl",
  "kai",
  "kaip",
  "tai",
  "dar",
  "jau",
  "bet",
  "prie",
  "nuo",
  "iki",
  "apie",
  "tarp",
  "gali",
  "tik",
  "vis",
  "visi",
  "visa",
  "jo",
  "jos",
  "jų",
  "jam",
  "jai",
  "daug",
  "labai",
  "nors",
  "net",
  "ne",
  "tada",
  "ten",
  "čia",
  "metų",
  "metus",
  "prieš",
  "po",
  "pagal",
  "po",
  "kur",
  "kas",
  "ką",
  "ko",
  "kuris",
  "kurie",
  "kurios",
  "būti",
  "būtų",
  "būna",
  "esą",
  "bent",
  "dar",
  "darbo",
  "dienos",
  "diena",
  "nauja",
  "naujas",
  "naujos",
  "naujienos",
  "naujieną",
  "žinios",
  "video",
  "foto",
  "nuotrauka",
  "reportažas",
  "interviu",
  "reklama",
  "specialus",
  "projektas",
  "daugiau",
  "skaitykite",
  "lietuvoje",
  "lietuvos",
  "lietuva",
  "portalas",
  "portalo",
  "portalų",
  "ministras",
  "ministro",
  "ministrų",
  "premjeras",
  "prezidentas",
  "seimo",
  "seimas",
  "valdžia",
  "valdžios",
  "šalis",
  "šalies",
  "šalys",
  "žmonės",
  "žmonių",
  "pasak",
  "teigia",
  "praneša",
  "pranešė",
  "nurodo",
  "nurodė",
  "sako",
  "kalba",
  "kalbėjo",
  "planuoja",
  "ketina",
  "turėtų",
  "gali",
  "galėjo",
  "nusprendė",
  "nutarė",
  "patvirtino",
  "pranešta",
  "pranešimas",
  "informuoja",
  "informavo",
  "antraštė",
  "straipsnis",
  "turinys",
  "eur",
  "euro",
  "mln",
  "mlrd",
  "proc",
  "procentų",
  "metai",
  "mėnesio",
  "mėnesį",
  "savaitės",
  "savaitę",
  "dieną",
  "vakar",
  "šiandien",
  "rytoj",
  "antradienį",
  "trečiadienį",
  "ketvirtadienį",
  "penktadienį",
  "šeštadienį",
  "sekmadienį",
  "pirmadienį",
]);

const GENERIC_NEWS_WORDS = new Set([
  "naujienos",
  "naujiena",
  "žinios",
  "politika",
  "politikos",
  "sportas",
  "sporto",
  "verslas",
  "verslo",
  "kultūra",
  "kultūros",
  "lietuvoje",
  "lietuvos",
  "lietuva",
  "pasaulio",
  "pasaulis",
  "regiono",
  "regione",
  "miesto",
  "miestas",
  "šalies",
  "šalis",
  "ministras",
  "ministro",
  "premjeras",
  "prezidentas",
  "seimo",
  "seimas",
]);

export interface RelatedHeadlineCandidate {
  slug: string;
  title: string;
  excerpt: string;
  source: string;
  sourceId: string;
  originalUrl: string;
  publishedDate: string;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEntities(originalText: string): string[] {
  const entities: string[] = [];
  const patterns = [
    /\b[\p{Lu}][\p{L}]{2,}(?:\s+[\p{Lu}][\p{L}]{2,}){0,3}\b/gu,
    /\b\d{4}\b/g,
    /\b\d{1,3}(?:[.,]\d{3})*(?:\s*(?:mln|mlrd|eur|proc\.?))?\b/gi,
  ];

  for (const pattern of patterns) {
    const matches = originalText.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalized = normalizeText(match);
        if (normalized.length >= 3 && !LT_STOP_WORDS.has(normalized)) {
          entities.push(normalized);
        }
      }
    }
  }

  return entities;
}

function tokenize(text: string, originalText?: string): Set<string> {
  const normalized = normalizeText(text);
  const tokens = normalized
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !LT_STOP_WORDS.has(word));

  const entities = originalText ? extractEntities(originalText) : [];
  return new Set([...tokens, ...entities]);
}

function bigrams(tokens: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return result;
}

interface MatchScore {
  total: number;
  titleOverlap: number;
  entityOverlap: number;
  significantOverlap: number;
}

function scoreCandidate(
  queryTitle: string,
  queryExcerpt: string,
  candidateTitle: string,
  candidateExcerpt: string,
  relatedTopics: string[] = []
): MatchScore {
  const topicContext = relatedTopics.join(" ");
  const queryFull = `${queryTitle} ${queryExcerpt} ${topicContext}`.trim();
  const candidateFull = `${candidateTitle} ${candidateExcerpt}`;

  const queryTokens = tokenize(queryFull, queryTitle);
  const candidateTokens = tokenize(candidateFull, candidateTitle);
  const queryTitleTokens = tokenize(queryTitle, queryTitle);
  const candidateTitleTokens = tokenize(candidateTitle, candidateTitle);

  const queryEntities = new Set(extractEntities(queryTitle));
  const candidateEntities = new Set(extractEntities(candidateTitle));

  const shared = [...queryTokens].filter((token) => candidateTokens.has(token));
  const union = new Set([...queryTokens, ...candidateTokens]);
  const jaccard = union.size > 0 ? shared.length / union.size : 0;

  const titleOverlap = [...queryTitleTokens].filter((token) =>
    candidateTitleTokens.has(token)
  ).length;

  const entityOverlap = [...queryEntities].filter((entity) =>
    candidateEntities.has(entity)
  ).length;

  const significantOverlap = shared.filter(
    (token) => token.length >= 5 && !GENERIC_NEWS_WORDS.has(token)
  ).length;

  const queryBigramSet = new Set(
    bigrams([...queryTitleTokens].sort((a, b) => a.localeCompare(b)))
  );
  const candidateBigrams = bigrams(
    [...candidateTitleTokens].sort((a, b) => a.localeCompare(b))
  );
  const bigramOverlap = candidateBigrams.filter((gram) =>
    queryBigramSet.has(gram)
  ).length;

  let total = jaccard;
  total += titleOverlap * 0.12;
  total += entityOverlap * 0.2;
  total += significantOverlap * 0.1;
  total += bigramOverlap * 0.18;

  if (titleOverlap >= 3) total += 0.15;
  if (entityOverlap >= 1 && significantOverlap >= 1) total += 0.1;

  for (const topic of relatedTopics) {
    const topicTokens = tokenize(topic, topic);
    const topicOverlap = [...topicTokens].filter((token) =>
      candidateTokens.has(token)
    ).length;
    if (topicOverlap >= 2) total += 0.12;
    else if (topicOverlap >= 1) total += 0.06;
  }

  return {
    total,
    titleOverlap,
    entityOverlap,
    significantOverlap,
  };
}

function isStrongMatch(score: MatchScore): boolean {
  if (score.entityOverlap >= 1 && score.titleOverlap >= 2) return true;
  if (score.significantOverlap >= 2 && score.titleOverlap >= 2) return true;
  if (score.titleOverlap >= 3 && score.total >= 0.35) return true;
  return score.total >= 0.45;
}

function isWeakMatch(score: MatchScore): boolean {
  if (score.titleOverlap < 2 && score.entityOverlap === 0) return false;
  if (score.significantOverlap === 0 && score.entityOverlap === 0) return false;
  if (score.total < 0.22) return false;

  const onlyGeneric =
    score.significantOverlap === 0 &&
    score.entityOverlap === 0 &&
    score.titleOverlap >= 2;
  return !onlyGeneric;
}

function pickDiverseOutlets(
  scored: Array<{ item: RelatedHeadlineCandidate; score: MatchScore }>,
  limit: number,
  currentSource?: string
): Array<{ item: RelatedHeadlineCandidate; score: MatchScore }> {
  const picked: Array<{ item: RelatedHeadlineCandidate; score: MatchScore }> =
    [];
  const usedSources = new Set<string>();

  const sorted = [...scored].sort((a, b) => {
    const sourceBoost =
      (a.item.source !== currentSource ? 0.05 : 0) -
      (b.item.source !== currentSource ? 0.05 : 0);
    return b.score.total - a.score.total + sourceBoost;
  });

  for (const entry of sorted) {
    if (usedSources.has(entry.item.sourceId)) continue;
    picked.push(entry);
    usedSources.add(entry.item.sourceId);
    if (picked.length >= limit) break;
  }

  if (picked.length < limit) {
    for (const entry of sorted) {
      if (picked.some((p) => p.item.slug === entry.item.slug)) continue;
      picked.push(entry);
      if (picked.length >= limit) break;
    }
  }

  return picked;
}

async function refineWithLLM(
  articleTitle: string,
  articleExcerpt: string,
  candidates: RelatedHeadlineCandidate[]
): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || candidates.length === 0) return [];

  const list = candidates
    .slice(0, 20)
    .map((item, index) => `${index + 1}. [${item.source}] ${item.title}`)
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Tu esi Lietuvos naujienų redaktorius. Iš pateikto sąrašo parink tik tuos straipsnius, kurie semantiškai susiję su pagrindine tema (tas pats įvykis, subjektas ar klausimas) — ne populiariausias ar atsitiktines antraštes. Atsakyk tik numeriais atskirtais kableliais, pvz.: 2,5,9. Jei tikrai susijusių nėra — atsakyk: NONE",
          },
          {
            role: "user",
            content: `Pagrindinis straipsnis: "${articleTitle}"
Santrauka: ${articleExcerpt.slice(0, 400)}

Kandidatai:
${list}

Kurie numeriai apie tą pačią naujieną?`,
          },
        ],
        temperature: 0.1,
        max_tokens: 60,
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content || content.toUpperCase() === "NONE") return [];

    return content
      .split(/[,\s]+/)
      .map((part) => parseInt(part, 10))
      .filter(
        (num) => Number.isFinite(num) && num >= 1 && num <= candidates.length
      );
  } catch {
    return [];
  }
}

function toPerspective(item: RelatedHeadlineCandidate): AlternativePerspective {
  return {
    outlet: item.source,
    headline: item.title,
    excerpt: item.excerpt,
    url: item.originalUrl,
    slug: item.slug,
  };
}

export async function findRelatedHeadlinesFromCandidates(
  options: {
    title: string;
    excerpt?: string;
    relatedTopics?: string[];
    excludeSlug: string;
    currentSource?: string;
  },
  candidates: RelatedHeadlineCandidate[],
  limit = 3
): Promise<AlternativePerspective[]> {
  const excerpt = options.excerpt ?? "";
  const relatedTopics = options.relatedTopics ?? [];
  const maxAgeMs = 14 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const scored = candidates
    .filter((item) => item.slug !== options.excludeSlug)
    .filter((item) => {
      const age = now - new Date(item.publishedDate).getTime();
      return age <= maxAgeMs;
    })
    .map((item) => ({
      item,
      score: scoreCandidate(
        options.title,
        excerpt,
        item.title,
        item.excerpt,
        relatedTopics
      ),
    }))
    .filter(({ score }) => isWeakMatch(score))
    .sort((a, b) => b.score.total - a.score.total);

  const strongMatches = scored.filter(({ score }) => isStrongMatch(score));
  const localPool =
    strongMatches.length >= limit
      ? strongMatches
      : scored.filter(({ score }) => isStrongMatch(score) || score.total >= 0.3);

  if (localPool.length === 0) return [];

  const llmIndices = await refineWithLLM(
    options.title,
    [excerpt, ...relatedTopics].filter(Boolean).join(". ").slice(0, 500),
    localPool.slice(0, 20).map(({ item }) => item)
  );

  if (llmIndices.length > 0) {
    const llmPicked = llmIndices
      .map((index) => localPool[index - 1])
      .filter(Boolean);

    const diverse = pickDiverseOutlets(
      llmPicked,
      limit,
      options.currentSource
    );
    if (diverse.length > 0) {
      return diverse.map(({ item }) => toPerspective(item));
    }
  }

  // Su OpenAI — rodom tik LLM patvirtintas; be rakto — tik stiprūs atitikmenys
  if (process.env.OPENAI_API_KEY) {
    return [];
  }

  const diverse = pickDiverseOutlets(
    localPool.filter(({ score }) => isStrongMatch(score)),
    limit,
    options.currentSource
  );

  return diverse.map(({ item }) => toPerspective(item));
}
