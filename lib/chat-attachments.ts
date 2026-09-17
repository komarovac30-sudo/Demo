import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAT_ATTACHMENT_BUCKET = "chat-attachments";
export const CHAT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const CHAT_ATTACHMENT_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ChatMessageWithAttachment = {
  id: number;
  sender_type: "VISITOR" | "CREATOR";
  message: string;
  created_at: string;
  expires_at: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  attachment_url?: string | null;
};

export function attachmentExtension(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function cleanupExpiredChatData(admin: SupabaseClient) {
  const now = new Date().toISOString();
  const { data: expired } = await admin
    .from("chat_messages")
    .select("id,attachment_path")
    .lte("expires_at", now)
    .not("attachment_path", "is", null)
    .limit(100);

  const paths = (expired || []).map(row => row.attachment_path).filter(Boolean) as string[];
  if (paths.length) {
    const { error: storageError } = await admin.storage.from(CHAT_ATTACHMENT_BUCKET).remove(paths);
    if (!storageError) {
      const ids = (expired || []).map(row => row.id);
      if (ids.length) await admin.from("chat_messages").delete().in("id", ids);
    }
  }

  await admin.rpc("cleanup_expired_chats");
}

export async function addSignedAttachmentUrls(admin: SupabaseClient, messages: ChatMessageWithAttachment[]) {
  return Promise.all(messages.map(async message => {
    if (!message.attachment_path) return { ...message, attachment_url: null };
    const { data } = await admin.storage
      .from(CHAT_ATTACHMENT_BUCKET)
      .createSignedUrl(message.attachment_path, 15 * 60);
    return { ...message, attachment_url: data?.signedUrl || null };
  }));
}
