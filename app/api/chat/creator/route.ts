import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredChatData } from "@/lib/chat-attachments";
import { serviceSupabase, verifyRole } from "@/lib/supabase-service";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const creator = await verifyRole(token, "CREATOR");
  if (!creator) return NextResponse.json({ error: "Creator sign in required." }, { status: 401 });

  const admin = serviceSupabase();
  await cleanupExpiredChatData(admin);
  const { data: threads, error } = await admin.from("chat_threads")
    .select("id,guest_label,status,force_sms_only,created_at,last_activity_at")
    .eq("creator_id", creator.id)
    .order("last_activity_at", { ascending: false })
    .limit(80);
  if (error) return NextResponse.json({ error: "Unable to load conversations." }, { status: 500 });

  const ids = (threads || []).map(t => t.id);
  const latest = new Map<string, { message: string; created_at: string; sender_type: string; has_attachment: boolean }>();
  if (ids.length) {
    const { data: messages } = await admin.from("chat_messages")
      .select("thread_id,message,created_at,sender_type,attachment_path")
      .in("thread_id", ids)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(400);
    for (const item of messages || []) {
      if (!latest.has(item.thread_id)) latest.set(item.thread_id, {
        message: item.attachment_path && item.message === "Photo" ? "📷 Photo" : item.message,
        created_at: item.created_at,
        sender_type: item.sender_type,
        has_attachment: Boolean(item.attachment_path),
      });
    }
  }

  return NextResponse.json({
    threads: (threads || []).map(t => ({ ...t, force_sms_only: Boolean(t.force_sms_only), last_message: latest.get(t.id) || null })),
  });
}
