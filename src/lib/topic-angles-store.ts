import { promises as fs } from "fs";
import path from "path";
import type { Article, TopicAnglesPack } from "./types";
import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase-admin";

interface ArticleGateState {
  initialized: boolean;
  /** Straipsniai, kurie jau buvo feed’e prieš įjungiant vartus — rodomi be rakursų */
  legacySlugs: string[];
  /**
   * Nauji slug’ai, kurie neatitiko kokybės (per mažai šaltinių / info) —
   * nerodomi feed’e ir nešildomi iš naujo kiekvieną kartą.
   */
  skippedSlugs: string[];
}

export type PublishSkipReason =
  | "thin"
  | "no_sources"
  | "promotional"
  | "generation_failed"
  | "qa_failed";

export interface PreparedPublish {
  slug: string;
  title: string;
  excerpt: string;
  article: Article;
  pack: TopicAnglesPack;
}

type PackRow = {
  slug: string;
  status: "ready" | "skipped";
  pack: TopicAnglesPack | null;
  article: Article | null;
  title: string | null;
  excerpt: string | null;
  skip_reason: string | null;
};

type StoredFsPayload = {
  pack?: TopicAnglesPack;
  article?: Article;
  title?: string;
  excerpt?: string;
};

function serializeArticle(article: Article) {
  return {
    ...article,
    publishedDate: article.publishedDate
      ? article.publishedDate.toISOString()
      : undefined,
  };
}

function deserializeArticle(
  raw: Article | null | undefined
): Article | null {
  if (!raw || !raw.slug || !Array.isArray(raw.paragraphs)) return null;
  return {
    ...raw,
    publishedDate: raw.publishedDate
      ? new Date(raw.publishedDate as unknown as string)
      : undefined,
  };
}

function hasQualityPack(pack: TopicAnglesPack | null | undefined): boolean {
  return Boolean(pack?.angles?.some((angle) => angle.facts?.length > 0));
}

function isFullReady(row: {
  status?: string;
  pack?: TopicAnglesPack | null;
  article?: Article | null;
}): boolean {
  // Kokybė > kiekis: reikia ir straipsnio, ir „Kitu kampu“
  return (
    row.status === "ready" &&
    Boolean(row.article?.paragraphs?.length) &&
    hasQualityPack(row.pack)
  );
}

function dataRoot(): string {
  if (process.env.VERCEL) {
    return path.join("/tmp", "naujienos-topic-angles");
  }
  return path.join(process.cwd(), ".data", "topic-angles");
}

function packsDir(): string {
  return path.join(dataRoot(), "packs");
}

function gatePath(): string {
  return path.join(dataRoot(), "gate.json");
}

function skipPath(slug: string): string {
  return path.join(dataRoot(), "skipped", `${slug}.json`);
}

function packPath(slug: string): string {
  return path.join(packsDir(), `${slug}.json`);
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(packsDir(), { recursive: true });
  await fs.mkdir(path.join(dataRoot(), "skipped"), { recursive: true });
}

function useSupabase(): boolean {
  return isSupabaseConfigured();
}

// ——— Filesystem fallback (local be Supabase) ———

async function fsHasPack(slug: string): Promise<boolean> {
  try {
    await fs.access(packPath(slug));
    return true;
  } catch {
    return false;
  }
}

async function fsReadPayload(slug: string): Promise<StoredFsPayload | null> {
  try {
    const raw = await fs.readFile(packPath(slug), "utf8");
    const parsed = JSON.parse(raw) as StoredFsPayload & TopicAnglesPack;
    // Senas formatas: tiesiog pack
    if (Array.isArray((parsed as TopicAnglesPack).angles) && !parsed.pack) {
      return { pack: parsed as TopicAnglesPack };
    }
    return parsed;
  } catch {
    return null;
  }
}

async function fsReadPack(slug: string): Promise<TopicAnglesPack | null> {
  const payload = await fsReadPayload(slug);
  const pack = payload?.pack;
  if (!pack?.angles?.length) return null;
  return pack;
}

async function fsWritePack(slug: string, pack: TopicAnglesPack): Promise<void> {
  await ensureDirs();
  const prev = (await fsReadPayload(slug)) ?? {};
  await fs.writeFile(
    packPath(slug),
    JSON.stringify({ ...prev, pack }),
    "utf8"
  );
  try {
    await fs.unlink(skipPath(slug));
  } catch {
    // ignore
  }
}

async function fsWritePrepared(record: PreparedPublish): Promise<void> {
  await ensureDirs();
  await fs.writeFile(
    packPath(record.slug),
    JSON.stringify({
      pack: record.pack,
      article: serializeArticle(record.article),
      title: record.title,
      excerpt: record.excerpt,
    }),
    "utf8"
  );
  try {
    await fs.unlink(skipPath(record.slug));
  } catch {
    // ignore
  }
}

async function fsReadPrepared(slug: string): Promise<PreparedPublish | null> {
  const payload = await fsReadPayload(slug);
  if (!hasQualityPack(payload?.pack)) return null;
  const article = deserializeArticle(payload?.article ?? null);
  if (!article?.paragraphs?.length) return null;
  return {
    slug,
    title: payload!.title || article.title,
    excerpt: payload!.excerpt || "",
    article,
    pack: payload!.pack!,
  };
}

async function fsReadGate(): Promise<ArticleGateState> {
  try {
    const raw = await fs.readFile(gatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ArticleGateState>;
    return {
      initialized: Boolean(parsed.initialized),
      legacySlugs: Array.isArray(parsed.legacySlugs) ? parsed.legacySlugs : [],
      skippedSlugs: Array.isArray(parsed.skippedSlugs) ? parsed.skippedSlugs : [],
    };
  } catch {
    return { initialized: false, legacySlugs: [], skippedSlugs: [] };
  }
}

async function fsWriteGate(state: ArticleGateState): Promise<void> {
  await ensureDirs();
  await fs.writeFile(gatePath(), JSON.stringify(state), "utf8");
}

async function fsMarkSkipped(
  slug: string,
  reason: PublishSkipReason
): Promise<void> {
  await ensureDirs();
  await fs.writeFile(
    skipPath(slug),
    JSON.stringify({ reason, at: new Date().toISOString() }),
    "utf8"
  );
  const gate = await fsReadGate();
  if (!gate.skippedSlugs.includes(slug)) {
    gate.skippedSlugs = [...gate.skippedSlugs, slug].slice(-2000);
    await fsWriteGate(gate);
  }
}

async function fsIsSkipped(slug: string): Promise<boolean> {
  const gate = await fsReadGate();
  if (gate.skippedSlugs.includes(slug)) return true;
  try {
    await fs.access(skipPath(slug));
    return true;
  } catch {
    return false;
  }
}

async function fsSkipReason(slug: string): Promise<PublishSkipReason | null> {
  try {
    const raw = await fs.readFile(skipPath(slug), "utf8");
    const parsed = JSON.parse(raw) as { reason?: PublishSkipReason };
    return parsed.reason ?? "thin";
  } catch {
    const gate = await fsReadGate();
    return gate.skippedSlugs.includes(slug) ? "thin" : null;
  }
}

// ——— Supabase ———

async function sbReadGate(): Promise<ArticleGateState> {
  const sb = getSupabaseAdmin();
  if (!sb) return fsReadGate();

  try {
    const { data: gate, error } = await sb
      .from("publish_gate")
      .select("initialized, legacy_slugs")
      .eq("id", 1)
      .maybeSingle();

    if (error || !gate) {
      console.error("[topic-angles] publish_gate read", error?.message);
      return fsReadGate();
    }

    const { data: skippedRows } = await sb
      .from("topic_angle_packs")
      .select("slug")
      .eq("status", "skipped");

    return {
      initialized: Boolean(gate.initialized),
      legacySlugs: Array.isArray(gate.legacy_slugs) ? gate.legacy_slugs : [],
      skippedSlugs: (skippedRows ?? []).map((row) => row.slug as string),
    };
  } catch (err) {
    console.error("[topic-angles] publish_gate fetch failed", err);
    return fsReadGate();
  }
}

async function sbWriteGate(state: ArticleGateState): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const { error } = await sb.from("publish_gate").upsert({
    id: 1,
    initialized: state.initialized,
    legacy_slugs: state.legacySlugs,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[topic-angles] publish_gate write failed", error.message);
  }
}

async function sbFetchRows(slugs: string[]): Promise<Map<string, PackRow>> {
  const sb = getSupabaseAdmin();
  const map = new Map<string, PackRow>();
  if (!sb || slugs.length === 0) return map;

  const { data, error } = await sb
    .from("topic_angle_packs")
    .select("slug, status, pack, article, title, excerpt, skip_reason")
    .in("slug", slugs);

  if (error || !data) return map;

  for (const row of data) {
    map.set(row.slug as string, {
      slug: row.slug as string,
      status: row.status as "ready" | "skipped",
      pack: (row.pack as TopicAnglesPack | null) ?? null,
      article: deserializeArticle(
        (row.article as Article | null) ?? null
      ),
      title: (row.title as string | null) ?? null,
      excerpt: (row.excerpt as string | null) ?? null,
      skip_reason: (row.skip_reason as string | null) ?? null,
    });
  }
  return map;
}

export async function hasTopicAnglesPack(slug: string): Promise<boolean> {
  if (!slug) return false;
  const prepared = await readPreparedPublish(slug);
  return Boolean(prepared);
}

export async function readPreparedPublish(
  slug: string
): Promise<PreparedPublish | null> {
  if (!slug) return null;

  if (useSupabase()) {
    const sb = getSupabaseAdmin();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("topic_angle_packs")
          .select("slug, status, pack, article, title, excerpt")
          .eq("slug", slug)
          .eq("status", "ready")
          .maybeSingle();

        if (!error && data) {
          const pack = (data.pack as TopicAnglesPack | null) ?? null;
          const article = deserializeArticle(
            (data.article as Article | null) ?? null
          );
          if (isFullReady({ status: data.status as string, pack, article })) {
            return {
              slug,
              title: (data.title as string) || article!.title,
              excerpt: (data.excerpt as string) || "",
              article: article!,
              pack: pack ?? { angles: [], generatedAt: new Date().toISOString() },
            };
          }
        } else if (error) {
          console.error("[topic-angles] readPreparedPublish", error.message);
        }
      } catch (err) {
        console.error("[topic-angles] readPreparedPublish fetch failed", err);
      }
    }
    // Supabase nepasiekiamas / tuščia — lokalus fallback
    if (!process.env.VERCEL) {
      return fsReadPrepared(slug);
    }
    return null;
  }

  return fsReadPrepared(slug);
}

async function sbUpsertPrepared(record: PreparedPublish): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase not configured");

  const base = {
    slug: record.slug,
    status: "ready" as const,
    article: serializeArticle(record.article),
    title: record.title,
    excerpt: record.excerpt,
    skip_reason: null,
    generated_at: record.pack.generatedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from("topic_angle_packs").upsert({
    ...base,
    pack: record.pack,
  });

  if (error) {
    console.error("[topic-angles] writePreparedPublish failed", error.message);
    throw new Error(`Supabase write failed: ${error.message}`);
  }
}

export async function writePreparedPublish(
  record: PreparedPublish
): Promise<void> {
  if (useSupabase()) {
    try {
      await sbUpsertPrepared(record);
    } catch (err) {
      await fsWritePrepared(record);
      if (process.env.VERCEL) throw err;
      return;
    }
    if (!process.env.VERCEL) {
      await fsWritePrepared(record);
    }
    return;
  }

  await fsWritePrepared(record);
}

export async function getPreparedMetas(
  slugs: string[]
): Promise<Map<string, { title: string; excerpt: string }>> {
  const unique = [...new Set(slugs.filter(Boolean))];
  const map = new Map<string, { title: string; excerpt: string }>();
  if (unique.length === 0) return map;

  if (useSupabase()) {
    const rows = await sbFetchRows(unique);
    for (const slug of unique) {
      const row = rows.get(slug);
      if (!row || !isFullReady(row)) continue;
      map.set(slug, {
        title: row.title || row.article!.title,
        excerpt: row.excerpt || "",
      });
    }
    return map;
  }

  for (const slug of unique) {
    const prepared = await fsReadPrepared(slug);
    if (!prepared) continue;
    map.set(slug, { title: prepared.title, excerpt: prepared.excerpt });
  }
  return map;
}

export async function readTopicAnglesPack(
  slug: string
): Promise<TopicAnglesPack | null> {
  if (!slug) return null;

  if (useSupabase()) {
    const sb = getSupabaseAdmin();
    if (!sb) return null;
    const { data } = await sb
      .from("topic_angle_packs")
      .select("pack, status")
      .eq("slug", slug)
      .eq("status", "ready")
      .maybeSingle();
    const pack = data?.pack as TopicAnglesPack | null | undefined;
    if (!pack?.angles?.length) return null;
    return pack;
  }

  return fsReadPack(slug);
}

export async function writeTopicAnglesPack(
  slug: string,
  pack: TopicAnglesPack
): Promise<void> {
  if (useSupabase()) {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    await sb.from("topic_angle_packs").upsert({
      slug,
      status: "ready",
      pack,
      skip_reason: null,
      generated_at: pack.generatedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return;
  }

  await fsWritePack(slug, pack);
}

export async function markPublishSkipped(
  slug: string,
  reason: PublishSkipReason
): Promise<void> {
  if (useSupabase()) {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    const { error } = await sb.from("topic_angle_packs").upsert({
      slug,
      status: "skipped",
      pack: null,
      article: null,
      title: null,
      excerpt: null,
      skip_reason: reason,
      generated_at: null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[topic-angles] markPublishSkipped failed", error.message);
    }
    return;
  }

  await fsMarkSkipped(slug, reason);
}

export async function isPublishSkipped(slug: string): Promise<boolean> {
  if (useSupabase()) {
    const sb = getSupabaseAdmin();
    if (!sb) return false;
    const { data } = await sb
      .from("topic_angle_packs")
      .select("slug")
      .eq("slug", slug)
      .eq("status", "skipped")
      .maybeSingle();
    return Boolean(data);
  }

  return fsIsSkipped(slug);
}

export async function getPublishSkipReason(
  slug: string
): Promise<PublishSkipReason | null> {
  if (useSupabase()) {
    const sb = getSupabaseAdmin();
    if (!sb) return null;
    const { data } = await sb
      .from("topic_angle_packs")
      .select("skip_reason, status")
      .eq("slug", slug)
      .eq("status", "skipped")
      .maybeSingle();
    if (!data) return null;
    return (data.skip_reason as PublishSkipReason) ?? "thin";
  }

  return fsSkipReason(slug);
}

async function readGate(): Promise<ArticleGateState> {
  if (useSupabase()) return sbReadGate();
  return fsReadGate();
}

async function writeGate(state: ArticleGateState): Promise<void> {
  if (useSupabase()) {
    await sbWriteGate(state);
    return;
  }
  await fsWriteGate(state);
}

/**
 * Nauji slug’ai (ne legacy ir be rakursų) nelenda į feed’ą.
 * Skipped (per silpna info) — taip pat nerodomi.
 * Pirmą kartą paleidus — visi dabartiniai slug’ai tampa legacy.
 */
export async function resolvePublishableSlugs(currentSlugs: string[]): Promise<{
  publishable: Set<string>;
  pending: string[];
  skipped: string[];
}> {
  const unique = [...new Set(currentSlugs.filter(Boolean))];
  let gate = await readGate();

  if (!gate.initialized) {
    // Naujas gate: nieko nepažymim legacy — visi eina per prepare prieš feed
    gate = { initialized: true, legacySlugs: [], skippedSlugs: [] };
    await writeGate(gate);
    return { publishable: new Set(), pending: unique, skipped: [] };
  }

  const legacy = new Set(gate.legacySlugs);
  const publishable = new Set<string>();
  const pending: string[] = [];
  const skipped: string[] = [];

  if (useSupabase()) {
    const rows = await sbFetchRows(unique);
    for (const slug of unique) {
      if (legacy.has(slug)) {
        publishable.add(slug);
        continue;
      }
      const row = rows.get(slug);
      if (row && isFullReady(row)) {
        publishable.add(slug);
        continue;
      }
      // Lokalus paruoštas straipsnis (kai Supabase fetch failina)
      if (!process.env.VERCEL && (await fsReadPrepared(slug))) {
        publishable.add(slug);
        continue;
      }
      if (row?.status === "skipped") {
        if (row.skip_reason === "promotional") {
          skipped.push(slug);
          continue;
        }
      }
      pending.push(slug);
    }
    return { publishable, pending, skipped };
  }

  const skippedSet = new Set(gate.skippedSlugs);
  for (const slug of unique) {
    if (legacy.has(slug)) {
      publishable.add(slug);
      continue;
    }
    if (await fsReadPrepared(slug)) {
      publishable.add(slug);
      continue;
    }
    if (skippedSet.has(slug) || (await fsIsSkipped(slug))) {
      skipped.push(slug);
      continue;
    }
    pending.push(slug);
  }

  return { publishable, pending, skipped };
}

export async function isArticlePublishable(slug: string): Promise<boolean> {
  const gate = await readGate();
  if (!gate.initialized) return true;
  if (gate.legacySlugs.includes(slug)) return true;
  return Boolean(await readPreparedPublish(slug));
}
