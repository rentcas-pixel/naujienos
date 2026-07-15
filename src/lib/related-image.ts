import type { RelatedImage } from "./types";

const USER_AGENT = "SkaitmeninisSkaitymoPalydovas/1.0";

async function getWikipediaImage(
  term: string,
  lang: string
): Promise<RelatedImage | null> {
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`,
      {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate: 86400 },
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const url = data.thumbnail?.source || data.originalimage?.source;
    if (!url) return null;

    return {
      url,
      caption: data.description || data.title || term,
      sourceUrl: data.content_urls?.desktop?.page,
    };
  } catch {
    return null;
  }
}

async function searchCommons(query: string): Promise<RelatedImage | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "640",
      format: "json",
      origin: "*",
    });

    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params}`,
      {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate: 86400 },
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as {
      title?: string;
      imageinfo?: { thumburl?: string; url?: string }[];
    };
    const info = page?.imageinfo?.[0];
    const url = info?.thumburl || info?.url;
    if (!url) return null;

    return {
      url,
      caption: query,
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? "")}`,
    };
  } catch {
    return null;
  }
}

function searchTerms(text: string): string[] {
  const cleaned = text.replace(/[„""''«»]/g, "").trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 3);
  const terms = [cleaned];
  if (words.length > 0) terms.push(words[0]);
  if (words.length > 1) terms.push(words.slice(0, 2).join(" "));
  return [...new Set(terms)];
}

export function isPhotoRequest(text: string): boolean {
  return /foto|nuotrau|paveiksl|image|photo|pic/i.test(text);
}

async function opensearch(term: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=1&format=json&origin=*`,
      { headers: { "User-Agent": USER_AGENT }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data[1]?.[0] ?? null;
  } catch {
    return null;
  }
}

async function getEnglishSearchTerm(term: string): Promise<string | null> {
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
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Lietuviškas terminas: „${term}". Atsakyk TIK anglišku Wikipedia straipsnio pavadinimu (1–4 žodžiai), be kabučių. Pvz.: žievėgraužis → Bark beetle`,
          },
        ],
        temperature: 0,
        max_tokens: 20,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/** Ieško susijusios nuotraukos pagal pažymėtą terminą */
export async function findRelatedImage(
  term: string,
  articleImageUrl?: string
): Promise<RelatedImage | null> {
  if (articleImageUrl) {
    return {
      url: articleImageUrl,
      caption: "Straipsnio nuotrauka",
    };
  }

  const terms = searchTerms(term);

  for (const t of terms) {
    for (const lang of ["lt", "en"]) {
      const title = (await opensearch(t, lang)) ?? t;
      const img = await getWikipediaImage(title, lang);
      if (img) return img;
    }
    const commons = await searchCommons(t);
    if (commons) return commons;
  }

  const english = await getEnglishSearchTerm(term);
  if (english) {
    const img = await getWikipediaImage(english, "en");
    if (img) return img;
    const commons = await searchCommons(english);
    if (commons) return commons;
  }

  return null;
}

export function articleImageFromUrl(url: string): RelatedImage {
  return { url, caption: "Straipsnio nuotrauka" };
}
