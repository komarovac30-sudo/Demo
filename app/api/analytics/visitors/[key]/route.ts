import { NextRequest, NextResponse } from "next/server";
import { buildSessions, eventKey, readVisitorAnalytics, summarizeVisitors } from "@/lib/visitor-analytics";

export async function GET(req: NextRequest, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const creatorId = req.nextUrl.searchParams.get("creator_id");
  const result = await readVisitorAnalytics(token, creatorId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const events = result.events.filter(event => eventKey(event) === key);
  if (!events.length) return NextResponse.json({ error: "Visitor not found." }, { status: 404 });

  const summary = summarizeVisitors(events, result.creatorMap)[0];
  const mediaIds = [...new Set(events.map(e => e.media_id).filter(Boolean))] as string[];
  const mediaMap = new Map<string, string>();
  if (mediaIds.length) {
    const { data: media } = await result.admin.from("media").select("id,title").in("id", mediaIds);
    (media || []).forEach(item => mediaMap.set(item.id, item.title || "Untitled media"));
  }

  const timeline = [...events]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(event => ({
      id: event.id,
      event_type: event.event_type,
      created_at: event.created_at,
      media_id: event.media_id,
      media_title: event.media_id ? (mediaMap.get(event.media_id) || null) : null,
      creator_id: event.profile_id,
      creator_name: result.creatorMap.get(event.profile_id) || "Creator",
    }));

  const mediaInterest = new Map<string, { media_id: string; title: string; views: number; likes: number }>();
  for (const event of events) {
    if (!event.media_id) continue;
    const row = mediaInterest.get(event.media_id) || { media_id: event.media_id, title: mediaMap.get(event.media_id) || "Untitled media", views: 0, likes: 0 };
    if (["PHOTO_VIEW", "VIDEO_PLAY", "VIDEO_COMPLETE"].includes(event.event_type)) row.views += 1;
    if (event.event_type === "MEDIA_LIKE") row.likes += 1;
    if (event.event_type === "MEDIA_UNLIKE") row.likes = Math.max(row.likes - 1, 0);
    mediaInterest.set(event.media_id, row);
  }

  return NextResponse.json({
    scope: result.viewer.role,
    summary,
    sessions: buildSessions(events),
    timeline,
    media_interest: [...mediaInterest.values()].sort((a, b) => (b.views + b.likes) - (a.views + a.likes)).slice(0, 8),
  });
}
