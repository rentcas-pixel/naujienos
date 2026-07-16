import { promises as fs } from "fs";
import path from "path";
import type { TopicAnglesPack } from "./types";

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

async function ensureDirs(): Promise<void> {
  await fs.mkdir(packsDir(), { recursive: true });
  await fs.mkdir(path.join(dataRoot(), "skipped"), { recursive: true });
}

function packPath(slug: string): string {
  return path.join(packsDir(), `${slug}.json`);
}

export async function hasTopicAnglesPack(slug: string): Promise<boolean> {
  try {
    await fs.access(packPath(slug));
    return true;
  } catch {
    return false;
  }
}

export async function readTopicAnglesPack(
  slug: string
): Promise<TopicAnglesPack | null> {
  try {
    const raw = await fs.readFile(packPath(slug), "utf8");
    const parsed = JSON.parse(raw) as TopicAnglesPack;
    if (!parsed?.angles?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeTopicAnglesPack(
  slug: string,
  pack: TopicAnglesPack
): Promise<void> {
  await ensureDirs();
  await fs.writeFile(packPath(slug), JSON.stringify(pack), "utf8");
  // Jei anksčiau buvo skipped — nuimam
  try {
    await fs.unlink(skipPath(slug));
  } catch {
    // ignore
  }
}

async function readGate(): Promise<ArticleGateState> {
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

async function writeGate(state: ArticleGateState): Promise<void> {
  await ensureDirs();
  await fs.writeFile(gatePath(), JSON.stringify(state), "utf8");
}

export async function markPublishSkipped(
  slug: string,
  reason: PublishSkipReason
): Promise<void> {
  await ensureDirs();
  await fs.writeFile(
    skipPath(slug),
    JSON.stringify({ reason, at: new Date().toISOString() }),
    "utf8"
  );

  const gate = await readGate();
  if (!gate.skippedSlugs.includes(slug)) {
    gate.skippedSlugs = [...gate.skippedSlugs, slug].slice(-2000);
    await writeGate(gate);
  }
}

export async function isPublishSkipped(slug: string): Promise<boolean> {
  const gate = await readGate();
  if (gate.skippedSlugs.includes(slug)) return true;
  try {
    await fs.access(skipPath(slug));
    return true;
  } catch {
    return false;
  }
}

export async function getPublishSkipReason(
  slug: string
): Promise<PublishSkipReason | null> {
  try {
    const raw = await fs.readFile(skipPath(slug), "utf8");
    const parsed = JSON.parse(raw) as { reason?: PublishSkipReason };
    return parsed.reason ?? "thin";
  } catch {
    const gate = await readGate();
    return gate.skippedSlugs.includes(slug) ? "thin" : null;
  }
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
  const skippedSet = new Set(gate.skippedSlugs);
  const publishable = new Set<string>();
  const pending: string[] = [];
  const skipped: string[] = [];

  for (const slug of unique) {
    if (legacy.has(slug)) {
      publishable.add(slug);
      continue;
    }
    if (await hasTopicAnglesPack(slug)) {
      publishable.add(slug);
      continue;
    }
    if (skippedSet.has(slug) || (await isPublishSkipped(slug))) {
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
