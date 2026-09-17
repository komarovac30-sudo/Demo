import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { getVisitorContext } from "@/lib/visitor-context";
import { createUnlockToken, hashUnlockCode, unlockCookieName } from "@/lib/unlock-session";
import { timingSafeEqual } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const creatorId = String(body.creator_id || "");
    const code = String(body.code || "").trim();
    if (!creatorId || code.length < 4 || code.length > 64) {
      return NextResponse.json({ error: "Enter a valid unlock code." }, { status: 400 });
    }

    const admin = serviceSupabase();
    const { data: creator } = await admin.from("profiles").select("id,is_active,role").eq("id", creatorId).eq("role", "CREATOR").eq("is_active", true).maybeSingle();
    if (!creator) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const visitorContext = await getVisitorContext(req);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentFailures } = await admin.from("unlock_code_attempts").select("id", { count: "exact", head: true })
      .eq("creator_id", creatorId).eq("visitor_key", visitorContext.visitor_key).eq("succeeded", false).gte("created_at", tenMinutesAgo);
    if (Number(recentFailures || 0) >= 10) return NextResponse.json({ error: "Too many incorrect attempts. Please wait a few minutes and try again." }, { status: 429 });

    const { data: settings } = await admin.from("creator_payment_settings").select("unlock_code_hash").eq("creator_id", creatorId).maybeSingle();
    if (!settings?.unlock_code_hash) return NextResponse.json({ error: "Private access code has not been configured yet." }, { status: 409 });

    const supplied = Buffer.from(hashUnlockCode(creatorId, code));
    const stored = Buffer.from(String(settings.unlock_code_hash));
    const valid = supplied.length === stored.length && timingSafeEqual(supplied, stored);
    await admin.from("unlock_code_attempts").insert({ creator_id: creatorId, visitor_key: visitorContext.visitor_key, succeeded: valid });

    await admin.from("activity_events").insert({
      profile_id: creatorId,
      visitor_id: null,
      event_type: valid ? "UNLOCK_CODE_SUCCESS" : "UNLOCK_CODE_FAILED",
      metadata: { page: "public-profile", access_type: "temporary-code", ...visitorContext },
    });

    if (!valid) return NextResponse.json({ error: "That unlock code is not valid. Check the code and try again." }, { status: 401 });

    const maxAge = 60 * 60;
    const response = NextResponse.json({ ok: true, temporary: true, expires_in_seconds: maxAge });
    response.cookies.set(unlockCookieName(creatorId), createUnlockToken(creatorId, maxAge), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify unlock code." }, { status: 500 });
  }
}
