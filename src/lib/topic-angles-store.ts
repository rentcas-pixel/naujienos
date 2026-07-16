import { promises as fs } from "fs";
import path from "path";
import type { TopicAnglesPack } from "./types";
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

type PackRow = {
  slug: string;
  status: "ready" | "skipped";
  pack: TopicAnglesPack | null;
  skip_reason: string | null;
};

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

async function fsReadPack(slug: string): Promise<TopicAnglesPack | null> {
  try {
    const raw = await fs.readFile(packPath(slug), "utf8");
    const parsed = JSON.parse(raw) as TopicAnglesPack;
    if (!parsed?.angles?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fsWritePack(slug: string, pack: TopicAnglesPack): Promise<void> {
  await ensureDirs();
  await fs.writeFile(packPath(slug), JSON.stringify(pack), "utf8");
  try {
    await fs.unlink(skipPath(slug));
  } catch {
    // ignore
  }
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
  if (!sb) return { initialized: false, legacySlugs: [], skippedSlugs: [] };

  const { data: gate, error } = await sb
    .from("publish_gate")
    .select("initialized, legacy_slugs")
    .eq("id", 1)
    .maybeSingle();

  if (error || !gate) {
    return { initialized: false, legacySlugs: [], skippedSlugs: [] };
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
}

async function sbWriteGate(state: ArticleGateState): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  await sb.from("publish_gate").upsert({
    id: 1,
    initialized: state.initialized,
    legacy_slugs: state.legacySlugs,
    updated_at: new Date().toISOString(),
  });
}

async function sbFetchRows(slugs: string[]): Promise<Map<string, PackRow>> {
  const sb = getSupabaseAdmin();
  const map = new Map<string, PackRow>();
  if (!sb || slugs.length === 0) return map;

  const { data, error } = await sb
    .from("topic_angle_packs")
    .select("slug, status, pack, skip_reason")
    .in("slug", slugs);

  if (error || !data) return map;

  for (const row of data) {
    map.set(row.slug as string, {
      slug: row.slug as string,
      status: row.status as "ready" | "skipped",
      pack: (row.pack as TopicAnglesPack | null) ?? null,
      skip_reason: (row.skip_reason as string | null) ?? null,
    });
  }
  return map;
}

export async function hasTopicAnglesPack(slug: string): Promise<boolean> {
  if (!slug) return false;

  if (useSupabase()) {
    const sb = getSupabaseAdmin();
    if (!sb) return false;
    const { data } = await sb
      .from("topic_angle_packs")
      .select("slug")
      .eq("slug", slug)
      .eq("status", "ready")
      .maybeSingle();
    return Boolean(data);
  }

  return fsHasPack(slug);
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
    await sb.from("topic_angle_packs").upsert({
      slug,
      status: "skipped",
      pack: null,
      skip_reason: reason,
      generated_at: null,
      updated_at: new Date().toISOString(),
    });
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
    gate = { initialized: true, legacySlugs: unique, skippedSlugs: [] };
    await writeGate(gate);
    return { publishable: new Set(unique), pending: [], skipped: [] };
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
      if (row?.status === "ready" && row.pack?.angles?.length) {
        publishable.add(slug);
        continue;
      }
      if (row?.status === "skipped") {
        skipped.push(slug);
        continue;
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
    if (await fsHasPack(slug)) {
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
  return hasTopicAnglesPack(slug);
}
