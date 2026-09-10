import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { getVisitorContext } from "@/lib/visitor-context";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: mediaId } = await context.params;
  const admin = serviceSupabase();

  let visitorId: string | null = null;
  let visitorRole: string | null = null;
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (token) {
    const { data: { user } } = await admin.auth.getUser(token);
    if (user) {
      visitorId = user.id;
      const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      visitorRole = profile?.role || null;
    }
  }

  const { data: media } = await admin.from("media").select("id,creator_id,visibility,likes_count").eq("id", mediaId).maybeSingle();
  if (!media) return NextResponse.json({ error: "Media not found." }, { status: 404 });

  if (media.visibility === "LOCKED") {
    let allowed = visitorId === media.creator_id || visitorRole === "SUPER_ADMIN";
    if (visitorId && !allowed) {
      const { data: unlock } = await admin.from("profile_unlocks").select("id").eq("visitor_id", visitorId).eq("creator_id", media.creator_id).maybeSingle();
      allowed = Boolean(unlock);
    }
    if (!allowed) return NextResponse.json({ error: "Unlock this collection before liking it." }, { status: 403 });
  }

  const visitorContext = await getVisitorContext(req);
  const visitorKey = visitorContext.visitor_key;

  let existingQuery = admin.from("media_likes").select("id").eq("media_id", mediaId);
  if (visitorId) existingQuery = existingQuery.or(`visitor_id.eq.${visitorId},visitor_key.eq.${visitorKey}`);
  else existingQuery = existingQuery.eq("visitor_key", visitorKey);
  const { data: existing } = await existingQuery.limit(1).maybeSingle();

  let liked = false;
  let count = Number(media.likes_count || 0);
  if (existing) {
    await admin.from("media_likes").delete().eq("id", existing.id);
    count = Math.max(0, count - 1);
    liked = false;
  } else {
    const { error } = await admin.from("media_likes").insert({ media_id: mediaId, visitor_id: visitorId, visitor_key: visitorKey });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    count += 1;
    liked = true;
  }

  await admin.from("media").update({ likes_count: count }).eq("id", mediaId);
  await admin.from("activity_events").insert({
    profile_id: media.creator_id,
    visitor_id: visitorId,
    media_id: mediaId,
    event_type: liked ? "MEDIA_LIKE" : "MEDIA_UNLIKE",
    metadata: { page: "public-profile", ...visitorContext },
  });

  return NextResponse.json({ liked, likes_count: count });
}
