import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { getVisitorContext } from "@/lib/visitor-context";

const PUBLIC_EVENT_TYPES = new Set([
  "PROFILE_VIEW",
  "PHOTO_VIEW",
  "VIDEO_PLAY",
  "VIDEO_COMPLETE",
  "LOCKED_CONTENT_SEEN",
  "UNLOCK_CLICK",
  "AUTH_STARTED",
  "AUTH_SUCCESS",
  "AUTH_FAILED",
  "PAYMENT_STARTED",
  "PAYMENT_FAILED",
  "PAYMENT_CANCELLED",
  "REVIEW_STARTED",
  "CONTACT_PHONE_CLICK",
  "CONTACT_EMAIL_CLICK",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profileId = String(body.profile_id || "");
    const eventType = String(body.event_type || "");
    const mediaId = body.media_id ? String(body.media_id) : null;

    if (!profileId || !PUBLIC_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Invalid activity data." }, { status: 400 });
    }

    const admin = serviceSupabase();
    const { data: creator } = await admin
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .eq("role", "CREATOR")
      .eq("is_active", true)
      .maybeSingle();

    if (!creator) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    if (mediaId) {
      const { data: media } = await admin
        .from("media")
        .select("id")
        .eq("id", mediaId)
        .eq("creator_id", profileId)
        .maybeSingle();
      if (!media) return NextResponse.json({ error: "Media does not belong to this profile." }, { status: 400 });
    }

    let visitorId: string | null = null;
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
    if (token) {
      const { data: { user } } = await admin.auth.getUser(token);
      visitorId = user?.id || null;
    }

    const visitorContext = await getVisitorContext(req);
    const { error } = await admin.from("activity_events").insert({
      profile_id: profileId,
      visitor_id: visitorId,
      media_id: mediaId,
      event_type: eventType,
      metadata: { page: "public-profile", ...visitorContext },
    });

    if (error) return NextResponse.json({ error: "Unable to record activity." }, { status: 500 });
    return NextResponse.json({ ok: true, context: visitorContext });
  } catch {
    return NextResponse.json({ error: "Unable to track activity." }, { status: 500 });
  }
}
