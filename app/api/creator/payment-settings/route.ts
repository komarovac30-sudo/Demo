import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { hashUnlockCode } from "@/lib/unlock-session";

async function creatorFor(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) return null;
  const admin = serviceSupabase();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await admin.from("profiles").select("id,role").eq("id", user.id).maybeSingle();
  return profile?.role === "CREATOR" ? profile : null;
}

export async function GET(req: NextRequest) {
  const creator = await creatorFor(req);
  if (!creator) return NextResponse.json({ error: "Creator sign in required." }, { status: 401 });
  const admin = serviceSupabase();
  const { data, error } = await admin.from("creator_payment_settings")
    .select("btc_address,contact_phone,instructions,unlock_code_updated_at")
    .eq("creator_id", creator.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    settings: data || { btc_address: "", contact_phone: "", instructions: "", unlock_code_updated_at: null },
    unlock_code_configured: Boolean(data?.unlock_code_updated_at),
  });
}

export async function POST(req: NextRequest) {
  const creator = await creatorFor(req);
  if (!creator) return NextResponse.json({ error: "Creator sign in required." }, { status: 401 });
  try {
    const body = await req.json();
    const btcAddress = String(body.btc_address || "").trim().slice(0, 180) || null;
    const contactPhone = String(body.contact_phone || "").trim().slice(0, 80) || null;
    const instructions = String(body.instructions || "").trim().slice(0, 800) || null;
    const newCode = String(body.unlock_code || "").trim();
    if (newCode && (newCode.length < 6 || newCode.length > 64)) {
      return NextResponse.json({ error: "Unlock code must be 6–64 characters." }, { status: 400 });
    }
    const admin = serviceSupabase();
    const payload: Record<string, unknown> = {
      creator_id: creator.id,
      btc_address: btcAddress,
      contact_phone: contactPhone,
      instructions,
      updated_at: new Date().toISOString(),
    };
    if (newCode) {
      payload.unlock_code_hash = hashUnlockCode(creator.id, newCode);
      payload.unlock_code_updated_at = new Date().toISOString();
    }
    const { error } = await admin.from("creator_payment_settings").upsert(payload, { onConflict: "creator_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, unlock_code_changed: Boolean(newCode) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save payment settings." }, { status: 500 });
  }
}
