import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";

async function creatorFor(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) return null;
  const admin = serviceSupabase();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("id,role,chat_force_sms_only")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.role === "CREATOR" ? profile : null;
}

export async function GET(req: NextRequest) {
  const creator = await creatorFor(req);
  if (!creator) return NextResponse.json({ error: "Creator sign in required." }, { status: 401 });
  return NextResponse.json({ force_sms_only: Boolean(creator.chat_force_sms_only) });
}

export async function PATCH(req: NextRequest) {
  const creator = await creatorFor(req);
  if (!creator) return NextResponse.json({ error: "Creator sign in required." }, { status: 401 });
  try {
    const body = await req.json();
    const forceSmsOnly = Boolean(body.force_sms_only);
    const admin = serviceSupabase();
    const { error } = await admin
      .from("profiles")
      .update({ chat_force_sms_only: forceSmsOnly, updated_at: new Date().toISOString() })
      .eq("id", creator.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, force_sms_only: forceSmsOnly });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update chat mode." }, { status: 500 });
  }
}
