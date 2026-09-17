import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cleanChatMessage } from "@/lib/chat";
import {
  CHAT_ATTACHMENT_BUCKET,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MIMES,
  addSignedAttachmentUrls,
  attachmentExtension,
  cleanupExpiredChatData,
  type ChatMessageWithAttachment,
} from "@/lib/chat-attachments";
import { serviceSupabase, verifyRole } from "@/lib/supabase-service";

async function creatorThread(req: NextRequest, id: string) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const creator = await verifyRole(token, "CREATOR");
  if (!creator) return { error: "Creator sign in required.", status: 401 as const };
  const admin = serviceSupabase();
  const { data: thread } = await admin.from("chat_threads")
    .select("id,creator_id,guest_label,status,force_sms_only,created_at,last_activity_at")
    .eq("id", id).eq("creator_id", creator.id).maybeSingle();
  if (!thread) return { error: "Conversation not found.", status: 404 as const };
  return { admin, thread };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await creatorThread(req, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { admin, thread } = result;
  await cleanupExpiredChatData(admin);
  const { data: messages, error } = await admin.from("chat_messages")
    .select("id,sender_type,message,created_at,expires_at,attachment_path,attachment_name,attachment_mime,attachment_size")
    .eq("thread_id", thread.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: "Unable to load messages." }, { status: 500 });
  return NextResponse.json({
    thread: { ...thread, force_sms_only: Boolean(thread.force_sms_only) },
    messages: await addSignedAttachmentUrls(admin, (messages || []) as ChatMessageWithAttachment[]),
    retention_hours: 24,
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await creatorThread(req, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { admin, thread } = result;
  if (thread.status === "BLOCKED") return NextResponse.json({ error: "Unblock this visitor before replying." }, { status: 403 });

  const contentType = req.headers.get("content-type") || "";
  let message = "";
  let attachment: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    message = cleanChatMessage(form.get("message"));
    const candidate = form.get("attachment");
    if (candidate instanceof File && candidate.size > 0) attachment = candidate;
  } else {
    const body = await req.json();
    message = cleanChatMessage(body.message);
  }

  if (!message && !attachment) return NextResponse.json({ error: "Write a message or add a photo first." }, { status: 400 });
  if (attachment) {
    if (!CHAT_ATTACHMENT_MIMES.has(attachment.type)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
    if (attachment.size > CHAT_ATTACHMENT_MAX_BYTES) return NextResponse.json({ error: "Photo must be 4 MB or smaller." }, { status: 400 });
  }

  let attachmentPath: string | null = null;
  if (attachment) {
    const extension = attachmentExtension(attachment.type);
    attachmentPath = `${thread.creator_id}/${thread.id}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await attachment.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).upload(attachmentPath, buffer, {
      contentType: attachment.type,
      upsert: false,
      cacheControl: "60",
    });
    if (uploadError) return NextResponse.json({ error: "Unable to upload photo." }, { status: 500 });
  }

  const { data: created, error } = await admin.from("chat_messages").insert({
    thread_id: thread.id,
    sender_type: "CREATOR",
    message: message || "Photo",
    attachment_path: attachmentPath,
    attachment_name: attachment?.name || null,
    attachment_mime: attachment?.type || null,
    attachment_size: attachment?.size || null,
  }).select("id,sender_type,message,created_at,expires_at,attachment_path,attachment_name,attachment_mime,attachment_size").single();
  if (error || !created) {
    if (attachmentPath) await admin.storage.from(CHAT_ATTACHMENT_BUCKET).remove([attachmentPath]);
    return NextResponse.json({ error: "Unable to send message." }, { status: 500 });
  }
  await admin.from("chat_threads").update({ last_activity_at: new Date().toISOString() }).eq("id", thread.id);
  const [withUrl] = await addSignedAttachmentUrls(admin, [created] as ChatMessageWithAttachment[]);
  return NextResponse.json({ message: withUrl });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await creatorThread(req, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const { admin, thread } = result;
  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const status = body.status === "BLOCKED" ? "BLOCKED" : body.status === "ACTIVE" ? "ACTIVE" : "";
    if (!status) return NextResponse.json({ error: "Invalid chat status." }, { status: 400 });
    patch.status = status;
  }
  if (body.force_sms_only !== undefined) patch.force_sms_only = Boolean(body.force_sms_only);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No chat changes supplied." }, { status: 400 });

  const { data: updated, error } = await admin.from("chat_threads").update(patch).eq("id", thread.id)
    .select("id,status,force_sms_only").single();
  if (error || !updated) return NextResponse.json({ error: "Unable to update chat." }, { status: 500 });
  return NextResponse.json({ ok: true, status: updated.status, force_sms_only: Boolean(updated.force_sms_only) });
}
