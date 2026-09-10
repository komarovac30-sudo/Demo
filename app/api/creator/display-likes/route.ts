import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";

function validCount(value: unknown) {
  return Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 99_999_999;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const admin = serviceSupabase();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Your session is not valid." }, { status: 401 });

  const { data: creator } = await admin.from("profiles").select("id,role").eq("id", user.id).maybeSingle();
  if (!creator || creator.role !== "CREATOR") return NextResponse.json({ error: "Creator authorization required." }, { status: 403 });

  let body: { profile_likes_count?: unknown; media_id?: unknown; likes_count?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  if (body.profile_likes_count !== undefined) {
    if (!validCount(body.profile_likes_count)) return NextResponse.json({ error: "Invalid profile like count." }, { status: 400 });
    const count = Number(body.profile_likes_count);
    const { error } = await admin.from("profiles").update({ profile_likes_count: count, updated_at: new Date().toISOString() }).eq("id", creator.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, profile_likes_count: count });
  }

  const mediaId = String(body.media_id || "");
  if (!mediaId || !validCount(body.likes_count)) return NextResponse.json({ error: "Media and a valid like count are required." }, { status: 400 });
  const count = Number(body.likes_count);
  const { data: media, error: findError } = await admin.from("media").select("id,creator_id").eq("id", mediaId).eq("creator_id", creator.id).maybeSingle();
  if (findError || !media) return NextResponse.json({ error: "Media not found or not owned by this profile." }, { status: 404 });
  const { error } = await admin.from("media").update({ likes_count: count }).eq("id", mediaId).eq("creator_id", creator.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, media_id: mediaId, likes_count: count });
}
