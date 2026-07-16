import { NextRequest, NextResponse } from "next/server";
import { getTopicAnglesForSlug } from "@/lib/topic-angles";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();

  if (!slug) {
    return NextResponse.json({ error: "Trūksta slug" }, { status: 400 });
  }

  try {
    const pack = await getTopicAnglesForSlug(slug);
    if (!pack) {
      return NextResponse.json({ pack: null }, { status: 200 });
    }
    return NextResponse.json({ pack });
  } catch {
    return NextResponse.json(
      { error: "Nepavyko paruošti rakursų" },
      { status: 500 }
    );
  }
}
