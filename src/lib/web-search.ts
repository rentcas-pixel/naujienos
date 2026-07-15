export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const FACTUAL_QUERY =
  /peln|apyvart|finans|rezultat|gyventoj|statist|kiek|20[0-9]{2}|mln|milij|eur|akcij|kaina|duomen|metin|ketvirt|sekm|ignitis|kaun|vilni|lietuv/i;

const LINK_OR_MEDIA_QUERY =
  /youtube|youtu\.be|nuorod|nuorodą|link|url|vaizdo|video|įraš|transliac|kur\s+(?:rasti|pažiūr|matyt|žiūr)|šaltin|clip|film/i;

export function shouldUseWebSearch(question: string, selectedText?: string): boolean {
  const combined = `${question} ${selectedText ?? ""}`.trim();
  if (combined.length < 3) return false;
  return (
    FACTUAL_QUERY.test(combined) ||
    LINK_OR_MEDIA_QUERY.test(combined) ||
    combined.includes("?")
  );
}

export function buildSearchQuery(
  question: string,
  options?: { selectedText?: string; articleTitle?: string }
): string {
  const parts = [options?.selectedText, question, options?.articleTitle]
    .filter(Boolean)
    .map((part) => part!.trim());

  if (LINK_OR_MEDIA_QUERY.test(question)) {
    parts.push("youtube");
  }

  parts.push("Lietuva");

  return [...new Set(parts.join(" ").split(/\s+/))].join(" ").slice(0, 200);
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 8,
        include_answer: false,
      }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };

    return (data.results ?? [])
      .filter((item) => item.title && item.url)
      .map((item) => ({
        title: item.title!,
        url: item.url!,
        snippet: (item.content ?? "").slice(0, 500),
      }));
  } catch {
    return [];
  }
}

export function formatSearchResultsForPrompt(results: SearchResult[]): string {
  if (results.length === 0) return "";

  return results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.title}\nURL: ${result.url}\n${result.snippet}`
    )
    .join("\n\n");
}

export async function getSearchContext(
  question: string,
  options?: {
    selectedText?: string;
    articleTitle?: string;
    /** Visada ieškoti (pvz. ask/followup su Tavily) */
    always?: boolean;
  }
): Promise<string> {
  const useSearch =
    options?.always || shouldUseWebSearch(question, options?.selectedText);
  if (!useSearch || !process.env.TAVILY_API_KEY) return "";

  const query = buildSearchQuery(question, options);
  const results = await searchWeb(query);
  return formatSearchResultsForPrompt(results);
}
