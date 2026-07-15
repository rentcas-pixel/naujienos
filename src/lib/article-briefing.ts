import type {
  ArticleBriefing,
  ArticleParagraph,
  TimelineEvent,
} from "./types";

interface ExpandedArticlePayload {
  keyFacts: string[];
  paragraphs: string[];
  relatedTopics: string[];
  timeline: TimelineEvent[];
}

function isMetaParagraph(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    /piln(?:ą|a)\s+informacij/.test(normalized) ||
    /original(?:ų|u)\s+straipsn/.test(normalized) ||
    /šaltinio\s+portale/.test(normalized) ||
    /skaityti\s+(?:piln|daugiau|original)/.test(normalized) ||
    /daugiau\s+informacij(?:os|ą).*?(?:portale|svetainėje|čia)/.test(normalized)
  );
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 15);
}

export function parseExpandedArticle(raw: string): ExpandedArticlePayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ExpandedArticlePayload>;
    if (!Array.isArray(parsed.paragraphs)) return null;

    const keyFacts = (parsed.keyFacts ?? [])
      .map((fact) => String(fact).trim())
      .filter((fact) => fact.length > 0 && !isMetaParagraph(fact))
      .slice(0, 5);

    const paragraphs = parsed.paragraphs
      .map((paragraph) => String(paragraph).trim())
      .filter((paragraph) => paragraph.length > 0 && !isMetaParagraph(paragraph))
      .slice(0, 8);

    if (keyFacts.length < 3 && paragraphs.length === 0) return null;

    return {
      keyFacts:
        keyFacts.length >= 3
          ? keyFacts
          : splitIntoSentences(paragraphs[0] ?? "").slice(0, 5),
      paragraphs,
      relatedTopics: (parsed.relatedTopics ?? [])
        .map((topic) => String(topic).trim())
        .filter(Boolean)
        .slice(0, 5),
      timeline: (parsed.timeline ?? [])
        .map((event) => ({
          date: String(event.date ?? "").trim(),
          title: String(event.title ?? "").trim(),
          excerpt: String(event.excerpt ?? "").trim(),
        }))
        .filter((event) => event.title && event.excerpt)
        .slice(0, 6),
    };
  } catch {
    return null;
  }
}

export function toArticleParagraphs(
  keyFacts: string[],
  bodyParagraphs: string[]
): ArticleParagraph[] {
  const combined = [...keyFacts, ...bodyParagraphs].filter(Boolean);

  return combined.map((text, index) => ({
    id: `p${index}`,
    text,
  }));
}

export function toBriefingMeta(
  payload: ExpandedArticlePayload
): ArticleBriefing {
  return {
    keyFacts: payload.keyFacts,
    relatedTopics: payload.relatedTopics,
    timeline: payload.timeline,
  };
}

export function buildMockExpansion(summary: string): ExpandedArticlePayload {
  const sentences = splitIntoSentences(summary);
  const keyFacts =
    sentences.length >= 3
      ? sentences.slice(0, Math.min(5, sentences.length))
      : [
          sentences[0] ?? summary,
          "Naujiena sulaukia dėmesio dėl galimų pasekmių platesnei visuomenei.",
          "Institucijos kol kas viešai nepatvirtino papildomų detalių.",
        ];

  const lead = summary.split(/(?<=[.!?…])\s+/)[0] ?? summary;

  return {
    keyFacts,
    paragraphs: [
      summary.length > lead.length ? summary : lead,
      "Kontekste tai reiškia, kad sprendimai ar įvykiai gali turėti ilgalaikių pasekmių.",
      "Skaitytojams svarbu sekti tolimesnius oficialius pranešimus ir patikslinimus.",
    ].filter(Boolean),
    relatedTopics: [],
    timeline: [],
  };
}
