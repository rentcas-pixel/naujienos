import { XMLParser } from "fast-xml-parser";

const USER_AGENT = "SkaitmeninisSkaitymoPalydovas/1.0";
const FETCH_TIMEOUT_MS = 6000;

export interface RssItem {
  title?: string;
  link?: string;
  guid?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  description?: string;
  categories?: string[];
  enclosure?: { url?: string; type?: string };
  "media:content"?: { "@_url"?: string } | { "@_url"?: string }[];
}

export interface ParsedFeed {
  items: RssItem[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "__cdata",
  isArray: (name) => name === "item" || name === "entry",
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function readText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.__cdata === "string") return record.__cdata;
    if (typeof record["#text"] === "string") return record["#text"];
  }
  return undefined;
}

function readCategories(raw: Record<string, unknown>): string[] {
  const value = raw.category;
  if (value == null) return [];

  const list = asArray(value as unknown);
  return list
    .map((entry) => {
      if (typeof entry === "string") return entry;
      return readText(entry) ?? "";
    })
    .map((tag) => tag.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeRssItem(raw: Record<string, unknown>): RssItem {
  const contentEncoded = readText(raw["content:encoded"]);
  const description = readText(raw.description);
  const summary = readText(raw.summary);
  const content = readText(raw.content);

  const enclosureRaw = raw.enclosure as
    | { "@_url"?: string; "@_type"?: string }
    | undefined;

  const mediaContent = raw["media:content"];
  const mediaArray = asArray(
    mediaContent as { "@_url"?: string } | { "@_url"?: string }[] | undefined
  );

  return {
    title: readText(raw.title),
    link: readText(raw.link),
    guid: readText(raw.guid),
    pubDate: readText(raw.pubDate),
    published: readText(raw.published),
    updated: readText(raw.updated),
    content: contentEncoded || content || description,
    contentSnippet: description || summary,
    summary,
    description,
    categories: readCategories(raw),
    enclosure: enclosureRaw?.["@_url"]
      ? { url: enclosureRaw["@_url"], type: enclosureRaw["@_type"] }
      : undefined,
    "media:content":
      mediaArray.length === 1
        ? mediaArray[0]
        : mediaArray.length > 1
          ? mediaArray
          : undefined,
  };
}

function normalizeAtomEntry(raw: Record<string, unknown>): RssItem {
  const linkRaw = raw.link;
  const links = asArray(linkRaw as Record<string, unknown> | Record<string, unknown>[]);
  const alternateLink =
    links.find((entry) => entry["@_rel"] === "alternate") ?? links[0];
  const link = readText(alternateLink?.["@_href"] ?? alternateLink);

  const contentNode = raw.content as Record<string, unknown> | undefined;
  const summary = readText(raw.summary);
  const mediaGroup = raw["media:group"] as Record<string, unknown> | undefined;
  const mediaDescription = readText(mediaGroup?.["media:description"]);
  const mediaThumbnail = mediaGroup?.["media:thumbnail"] as
    | { "@_url"?: string }
    | undefined;
  const body = readText(contentNode) || mediaDescription || summary;

  return {
    title: readText(raw.title),
    link,
    guid: readText(raw.id),
    published: readText(raw.published),
    updated: readText(raw.updated),
    pubDate: readText(raw.published) || readText(raw.updated),
    content: body,
    contentSnippet: mediaDescription || summary,
    summary: mediaDescription || summary,
    "media:content": mediaThumbnail?.["@_url"]
      ? { "@_url": mediaThumbnail["@_url"] }
      : undefined,
  };
}

function parseFeedXml(xml: string): ParsedFeed {
  const parsed = xmlParser.parse(xml);

  if (parsed?.rss?.channel) {
    const items = asArray(parsed.rss.channel.item as Record<string, unknown>[]);
    return { items: items.map(normalizeRssItem) };
  }

  if (parsed?.feed) {
    const entries = asArray(parsed.feed.entry as Record<string, unknown>[]);
    return { items: entries.map(normalizeAtomEntry) };
  }

  return { items: [] };
}

export async function fetchRssFeed(feedUrl: string): Promise<ParsedFeed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: controller.signal,
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      throw new Error(`Status code ${response.status}`);
    }

    const xml = await response.text();
    return parseFeedXml(xml);
  } finally {
    clearTimeout(timeout);
  }
}
