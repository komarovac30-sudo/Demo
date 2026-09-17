import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { CHAT_RETENTION_HOURS, cleanChatMessage, guestLabelFromHash, hashGuestToken } from "@/lib/chat";

function readGuestToken(req: NextRequest) {
  const token = (req.headers.get("x-guest-token") || "").trim();
  return token.length >= 16 && token.length <= 200 ? token : "";
}

async function ensureThread(creatorId: string, guestToken: string) {
  const admin = serviceSupabase();
  const { data: creator } = await admin.from("profiles").select("id,is_active,role").eq("id", creatorId).eq("role", "CREATOR").eq("is_active", true).maybeSingle();
  if (!creator) return { error: "Profile not available.", status: 404 as const };

  const guestHash = hashGuestToken(guestToken);
  const { data: existing } = await admin.from("chat_threads").select("id,creator_id,guest_label,status,created_at,last_activity_at").eq("creator_id", creatorId).eq("guest_key_hash", guestHash).maybeSingle();
  if (existing) return { admin, thread: existing };

  const { data: created, error } = await admin.from("chat_threads").insert({
    creator_id: creatorId,
    guest_key_hash: guestHash,
    guest_label: guestLabelFromHash(guestHash),
  }).select("id,creator_id,guest_label,status,created_at,last_activity_at").single();
  if (error || !created) return { error: "Unable to start chat.", status: 500 as const };
  return { admin, thread: created };
}

export async function GET(req: NextRequest) {
  try {
    const creatorId = (req.nextUrl.searchParams.get("creator_id") || "").trim();
    const guestToken = readGuestToken(req);
    if (!creatorId || !guestToken) return NextResponse.json({ error: "Chat identity is missing." }, { status: 400 });

    const result = await ensureThread(creatorId, guestToken);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { admin, thread } = result;
    await admin.rpc("cleanup_expired_chats");

    const { data: messages, error } = await admin.from("chat_messages")
      .select("id,sender_type,message,created_at,expires_at")
      .eq("thread_id", thread.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(80);
    if (error) return NextResponse.json({ error: "Unable to load chat." }, { status: 500 });

    return NextResponse.json({
      thread: { id: thread.id, label: thread.guest_label, status: thread.status },
      messages: messages || [],
      retention_hours: CHAT_RETENTION_HOURS,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load chat." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guestToken = readGuestToken(req);
    const body = await req.json();
    const creatorId = String(body.creator_id || "").trim();
    const message = cleanChatMessage(body.message);
    if (!creatorId || !guestToken || !message) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

    const result = await ensureThread(creatorId, guestToken);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { admin, thread } = result;
    await admin.rpc("cleanup_expired_chats");
    if (thread.status === "BLOCKED") return NextResponse.json({ error: "Chat is unavailable for this visitor." }, { status: 403 });

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from("chat_messages").select("id", { count: "exact", head: true })
      .eq("thread_id", thread.id).eq("sender_type", "VISITOR").gte("created_at", oneMinuteAgo);
    if ((count || 0) >= 6) return NextResponse.json({ error: "Please wait a moment before sending another message." }, { status: 429 });

    const { data: created, error } = await admin.from("chat_messages").insert({
      thread_id: thread.id,
      sender_type: "VISITOR",
      message,
    }).select("id,sender_type,message,created_at,expires_at").single();
    if (error || !created) return NextResponse.json({ error: "Unable to send message." }, { status: 500 });
    await admin.from("chat_threads").update({ last_activity_at: new Date().toISOString() }).eq("id", thread.id);

    return NextResponse.json({ message: created });
  } catch {
    return NextResponse.json({ error: "Unable to send message." }, { status: 500 });
  }
}
