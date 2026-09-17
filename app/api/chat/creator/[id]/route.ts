import { NextRequest, NextResponse } from "next/server";
import { cleanChatMessage } from "@/lib/chat";
import { serviceSupabase, verifyRole } from "@/lib/supabase-service";

async function creatorThread(req: NextRequest, id: string) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const creator = await verifyRole(token, "CREATOR");
  if (!creator) return { error: "Creator sign in required.", status: 401 as const };
  const admin = serviceSupabase();
  const { data: thread } = await admin.from("chat_threads").select("id,creator_id,guest_label,status,created_at,last_activity_at").eq("id", id).eq("creator_id", creator.id).maybeSingle();
  if (!thread) return { error: "Conversation not found.", status: 404 as const };
  return { admin, thread };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await creatorThread(req, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { admin, thread } = result;
  await admin.rpc("cleanup_expired_chats");
  const { data: messages, error } = await admin.from("chat_messages")
    .select("id,sender_type,message,created_at,expires_at")
    .eq("thread_id", thread.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: "Unable to load messages." }, { status: 500 });
  return NextResponse.json({ thread, messages: messages || [], retention_hours: 24 });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await creatorThread(req, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { admin, thread } = result;
  if (thread.status === "BLOCKED") return NextResponse.json({ error: "Unblock this visitor before replying." }, { status: 403 });
  const body = await req.json();
  const message = cleanChatMessage(body.message);
  if (!message) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const { data: created, error } = await admin.from("chat_messages").insert({ thread_id: thread.id, sender_type: "CREATOR", message })
    .select("id,sender_type,message,created_at,expires_at").single();
  if (error || !created) return NextResponse.json({ error: "Unable to send message." }, { status: 500 });
  await admin.from("chat_threads").update({ last_activity_at: new Date().toISOString() }).eq("id", thread.id);
  return NextResponse.json({ message: created });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await creatorThread(req, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { admin, thread } = result;
  const body = await req.json();
  const status = body.status === "BLOCKED" ? "BLOCKED" : body.status === "ACTIVE" ? "ACTIVE" : "";
  if (!status) return NextResponse.json({ error: "Invalid chat status." }, { status: 400 });
  const { error } = await admin.from("chat_threads").update({ status }).eq("id", thread.id);
  if (error) return NextResponse.json({ error: "Unable to update chat." }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
