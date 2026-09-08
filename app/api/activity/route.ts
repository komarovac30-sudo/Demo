import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { getVisitorContext } from "@/lib/visitor-context";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profileId = String(body.profile_id || "");
    const eventType = String(body.event_type || "");
    const mediaId = body.media_id ? String(body.media_id) : null;
    if (!profileId || !eventType) return NextResponse.json({ error: "Missing activity data." }, { status: 400 });

    const admin = serviceSupabase();
    const { data: creator } = await admin.from("profiles").select("id").eq("id", profileId).eq("role", "CREATOR").eq("is_active", true).maybeSingle();
    if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

    let visitorId: string | null = null;
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
    if (token) {
      const { data: { user } } = await admin.auth.getUser(token);
      visitorId = user?.id || null;
    }

    const context = await getVisitorContext(req);
    const metadata = { page: "public-profile", ...context, ...(body.metadata || {}) };
    const { error } = await admin.from("activity_events").insert({
      profile_id: profileId,
      visitor_id: visitorId,
      media_id: mediaId,
      event_type: eventType,
      metadata,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, context });
  } catch {
    return NextResponse.json({ error: "Unable to track activity." }, { status: 500 });
  }
}
