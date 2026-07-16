import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLatestNewsWithPending } from "@/lib/news";
import { warmTopicAnglesForSlugs } from "@/lib/topic-angles";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const batch = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 5), 1),
      8
    );

    const { pendingSlugs } = await getLatestNewsWithPending({
      todayOnly: true,
      limit: 40,
    });

    await warmTopicAnglesForSlugs(pendingSlugs, batch);

    if (pendingSlugs.length > 0) {
      revalidatePath("/");
    }

    return NextResponse.json({
      ok: true,
      pending: pendingSlugs.length,
      warmedUpTo: batch,
      supabase: isSupabaseConfigured(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
