import { NextRequest, NextResponse } from "next/server";
import { readVisitorAnalytics, summarizeVisitors } from "@/lib/visitor-analytics";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const creatorId = req.nextUrl.searchParams.get("creator_id");
  const result = await readVisitorAnalytics(token, creatorId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const visitors = summarizeVisitors(result.events, result.creatorMap);
  const profileViews = result.events.filter(e => e.event_type === "PROFILE_VIEW").length;
  const mediaViews = result.events.filter(e => ["PHOTO_VIEW", "VIDEO_PLAY", "VIDEO_COMPLETE"].includes(e.event_type)).length;
  const unlocks = result.events.filter(e => e.event_type === "UNLOCK_SUCCESS").length;
  const activeToday = visitors.filter(v => Date.now() - new Date(v.last_seen).getTime() <= 24 * 60 * 60 * 1000).length;
  const likes = result.events.filter(e => e.event_type === "MEDIA_LIKE").length - result.events.filter(e => e.event_type === "MEDIA_UNLIKE").length;

  return NextResponse.json({
    scope: result.viewer.role,
    visitors,
    totals: { unique_visitors: visitors.length, profile_views: profileViews, media_views: mediaViews, unlocks, likes, active_today: activeToday },
  });
}
