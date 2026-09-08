import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";

function decodeHeader(value: string | null) {
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return value; }
}

function detectDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const deviceType = /ipad|tablet/.test(ua) ? "Tablet" : /mobi|android|iphone/.test(ua) ? "Mobile" : "Desktop";
  const browser = /edg\//.test(ua) ? "Edge" : /opr\//.test(ua) ? "Opera" : /chrome\//.test(ua) ? "Chrome" : /safari\//.test(ua) && !/chrome\//.test(ua) ? "Safari" : /firefox\//.test(ua) ? "Firefox" : "Other";
  const os = /iphone|ipad|ios/.test(ua) ? "iOS" : /android/.test(ua) ? "Android" : /windows/.test(ua) ? "Windows" : /mac os|macintosh/.test(ua) ? "macOS" : /linux/.test(ua) ? "Linux" : "Other";
  return { deviceType, browser, os };
}

function visitorContext(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") || "";
  const device = detectDevice(userAgent);
  return {
    city: decodeHeader(req.headers.get("x-vercel-ip-city")),
    country: decodeHeader(req.headers.get("x-vercel-ip-country")),
    region: decodeHeader(req.headers.get("x-vercel-ip-country-region")),
    location_source: "ip",
    device_type: device.deviceType,
    browser: device.browser,
    os: device.os,
    user_agent: userAgent,
  };
}

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

    const context = visitorContext(req);
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
