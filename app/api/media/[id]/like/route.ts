import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { getVisitorContext } from "@/lib/visitor-context";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: mediaId } = await context.params;
  const admin = serviceSupabase();
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) return NextResponse.json({ error: "Sign in to like this post." }, { status: 401 });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Your session is no longer valid." }, { status: 401 });

  const { data: result, error } = await admin.rpc("toggle_media_like", {
    p_media_id: mediaId,
    p_visitor_id: user.id,
  });
  if (error) {
    const status = /locked/i.test(error.message) ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const row = Array.isArray(result) ? result[0] : result;
  if (!row) return NextResponse.json({ error: "Unable to update like." }, { status: 500 });

  const { data: media } = await admin.from("media").select("creator_id").eq("id", mediaId).maybeSingle();
  if (media?.creator_id) {
    const visitorContext = await getVisitorContext(req);
    await admin.from("activity_events").insert({
      profile_id: media.creator_id,
      visitor_id: user.id,
      media_id: mediaId,
      event_type: row.liked ? "MEDIA_LIKE" : "MEDIA_UNLIKE",
      metadata: { page: "public-profile", ...visitorContext },
    });
  }

  return NextResponse.json({ liked: Boolean(row.liked), likes_count: Number(row.likes_count || 0) });
}
