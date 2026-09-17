import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { CHAT_RETENTION_HOURS, cleanChatMessage, guestLabelFromHash, hashGuestToken } from "@/lib/chat";
import {
  CHAT_ATTACHMENT_BUCKET,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MIMES,
  addSignedAttachmentUrls,
  type ChatMessageWithAttachment,
  attachmentExtension,
  cleanupExpiredChatData,
} from "@/lib/chat-attachments";

function readGuestToken(req: NextRequest) {
  const token = (req.headers.get("x-guest-token") || "").trim();
  return token.length >= 16 && token.length <= 200 ? token : "";
}

async function ensureThread(creatorId: string, guestToken: string) {
  const admin = serviceSupabase();
  const { data: creator } = await admin.from("profiles").select("id,is_active,role").eq("id", creatorId).eq("role", "CREATOR").eq("is_active", true).maybeSingle();
  if (!creator) return { error: "Profile not available.", status: 404 as const };

  const guestHash = hashGuestToken(guestToken);
  const { data: existing } = await admin.from("chat_threads")
    .select("id,creator_id,guest_label,status,force_sms_only,created_at,last_activity_at")
    .eq("creator_id", creatorId).eq("guest_key_hash", guestHash).maybeSingle();
  if (existing) return { admin, thread: existing };

  const { data: created, error } = await admin.from("chat_threads").insert({
    creator_id: creatorId,
    guest_key_hash: guestHash,
    guest_label: guestLabelFromHash(guestHash),
    force_sms_only: false,
  }).select("id,creator_id,guest_label,status,force_sms_only,created_at,last_activity_at").single();
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
    await cleanupExpiredChatData(admin);

    const { data: messages, error } = await admin.from("chat_messages")
      .select("id,sender_type,message,created_at,expires_at,attachment_path,attachment_name,attachment_mime,attachment_size")
      .eq("thread_id", thread.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(80);
    if (error) return NextResponse.json({ error: "Unable to load chat." }, { status: 500 });

    return NextResponse.json({
      thread: { id: thread.id, label: thread.guest_label, status: thread.status, force_sms_only: Boolean(thread.force_sms_only) },
      messages: await addSignedAttachmentUrls(admin, (messages || []) as ChatMessageWithAttachment[]),
      retention_hours: CHAT_RETENTION_HOURS,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load chat." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guestToken = readGuestToken(req);
    const contentType = req.headers.get("content-type") || "";

    let creatorId = "";
    let message = "";
    let attachment: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      creatorId = String(form.get("creator_id") || "").trim();
      message = cleanChatMessage(form.get("message"));
      const candidate = form.get("attachment");
      if (candidate instanceof File && candidate.size > 0) attachment = candidate;
    } else {
      const body = await req.json();
      creatorId = String(body.creator_id || "").trim();
      message = cleanChatMessage(body.message);
    }

    if (!creatorId || !guestToken || (!message && !attachment)) {
      return NextResponse.json({ error: "Write a message or add a photo first." }, { status: 400 });
    }

    if (attachment) {
      if (!CHAT_ATTACHMENT_MIMES.has(attachment.type)) {
        return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
      }
      if (attachment.size > CHAT_ATTACHMENT_MAX_BYTES) {
        return NextResponse.json({ error: "Photo must be 4 MB or smaller." }, { status: 400 });
      }
    }

    const result = await ensureThread(creatorId, guestToken);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { admin, thread } = result;
    await cleanupExpiredChatData(admin);
    if (thread.force_sms_only) return NextResponse.json({ error: "This conversation is currently set to mobile text only." }, { status: 409 });
    if (thread.status === "BLOCKED") return NextResponse.json({ error: "Chat is unavailable for this visitor." }, { status: 403 });

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from("chat_messages").select("id", { count: "exact", head: true })
      .eq("thread_id", thread.id).eq("sender_type", "VISITOR").gte("created_at", oneMinuteAgo);
    if ((count || 0) >= 6) return NextResponse.json({ error: "Please wait a moment before sending another message." }, { status: 429 });

    let attachmentPath: string | null = null;
    if (attachment) {
      const extension = attachmentExtension(attachment.type);
      attachmentPath = `${creatorId}/${thread.id}/${randomUUID()}.${extension}`;
      const buffer = Buffer.from(await attachment.arrayBuffer());
      const { error: uploadError } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).upload(attachmentPath, buffer, {
        contentType: attachment.type,
        upsert: false,
        cacheControl: "60",
      });
      if (uploadError) return NextResponse.json({ error: "Unable to upload photo." }, { status: 500 });
    }

    const messageForDb = message || "Photo";
    const { data: created, error } = await admin.from("chat_messages").insert({
      thread_id: thread.id,
      sender_type: "VISITOR",
      message: messageForDb,
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
  } catch {
    return NextResponse.json({ error: "Unable to send message." }, { status: 500 });
  }
}
