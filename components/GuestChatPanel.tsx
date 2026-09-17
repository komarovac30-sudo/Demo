"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, MessageCircle, Phone, Send, Trash2, X } from "lucide-react";

type ChatMessage = {
  id: number;
  sender_type: "VISITOR" | "CREATOR";
  message: string;
  created_at: string;
  expires_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
};
type ChatPayload = {
  thread: { id: string; label: string; status: "ACTIVE" | "BLOCKED"; force_sms_only?: boolean };
  messages: ChatMessage[];
  retention_hours: number;
};

type Props = {
  creatorId: string;
  displayName: string;
  phone?: string | null;
  forceSmsOnly?: boolean; // Legacy fallback; V13 uses the per-visitor thread setting from the API.
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
};

const POLL_MS = 8000;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function ensureGuestToken() {
  const key = "veloura_guest_chat_token";
  let token = window.localStorage.getItem(key);
  if (!token) {
    token = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `${crypto.randomUUID()}-${crypto.randomUUID()}`
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, token);
  }
  return token;
}

function formatTime(value: string) {
  try { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
  catch { return ""; }
}

function cleanPhone(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

function smsHrefFor(phone: string, body: string) {
  const target = cleanPhone(phone);
  const isiOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const separator = isiOS ? "&" : "?";
  return `sms:${target}${separator}body=${encodeURIComponent(body)}`;
}

function isMobileDevice() {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export default function GuestChatPanel({ creatorId, displayName, phone, forceSmsOnly = false, open, onClose, initialMessage = "" }: Props) {
  const [token, setToken] = useState("");
  const [payload, setPayload] = useState<ChatPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [handoffNotice, setHandoffNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const firstName = useMemo(() => displayName.split(" ")[0] || displayName, [displayName]);
  const smsDraftKey = useMemo(() => `veloura_sms_draft_v13:${creatorId}`, [creatorId]);
  const effectiveForceSmsOnly = payload?.thread?.force_sms_only ?? forceSmsOnly;
  const smsHref = useMemo(() => {
    if (!phone) return "";
    const body = `Hi ${firstName}, I found your Veloura profile and would like to continue our conversation.`;
    return `sms:${cleanPhone(phone)}?body=${encodeURIComponent(body)}`;
  }, [phone, firstName]);

  useEffect(() => {
    if (!open) return;
    setToken(ensureGuestToken());
    setError("");
    setHandoffNotice("");
    if (initialMessage) setDraft(initialMessage);
    else setDraft(window.localStorage.getItem(smsDraftKey) || "");
  }, [open, initialMessage, smsDraftKey]);

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  useEffect(() => {
    if (!effectiveForceSmsOnly) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }, [effectiveForceSmsOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh(silent = false) {
    if (!token || !open) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/chat/guest?creator_id=${encodeURIComponent(creatorId)}`, {
        headers: { "x-guest-token": token }, cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load chat.");
      setPayload(body as ChatPayload); setError("");
    } catch (err) { if (!silent) setError(err instanceof Error ? err.message : "Unable to load chat."); }
    finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { if (token && open) refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, open, creatorId]);
  useEffect(() => {
    if (!token || !open) return;
    const timer = window.setInterval(() => refresh(true), POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, open, creatorId]);
  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, [payload?.messages.length, open]);

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function choosePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file || effectiveForceSmsOnly) return;
    setError("");
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo must be 4 MB or smaller.");
      e.target.value = "";
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function updateDraft(value: string) {
    setDraft(value);
    window.localStorage.setItem(smsDraftKey, value);
  }

  async function handoffToSms(message: string) {
    if (!phone) {
      setError("This profile has not configured a mobile text number yet.");
      return;
    }
    window.localStorage.setItem(smsDraftKey, message);
    setHandoffNotice("Your phone’s Messages app will open with this text ready. Review it and tap Send there.");

    if (!isMobileDevice()) {
      try {
        await navigator.clipboard.writeText(message);
        setHandoffNotice(`Text-only mode is enabled for this conversation. Your message was copied. Send it to ${phone} from your phone.`);
      } catch {
        setHandoffNotice(`Text-only mode is enabled for this conversation. Send this message to ${phone} from your phone.`);
      }
      return;
    }
    window.location.href = smsHrefFor(phone, message);
  }

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || payload?.thread.status === "BLOCKED") return;
    const message = draft.trim();

    if (effectiveForceSmsOnly) {
      if (!message) return;
      setError("");
      await handoffToSms(message);
      return;
    }

    if (!message && !photo) return;
    setSending(true); setError("");
    try {
      let res: Response;
      if (photo) {
        const fd = new FormData();
        fd.set("creator_id", creatorId);
        fd.set("message", message);
        fd.set("attachment", photo);
        res = await fetch("/api/chat/guest", { method: "POST", headers: { "x-guest-token": token }, body: fd });
      } else {
        res = await fetch("/api/chat/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-guest-token": token },
          body: JSON.stringify({ creator_id: creatorId, message }),
        });
      }
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409) await refresh(true);
        throw new Error(body.error || "Unable to send message.");
      }
      setDraft("");
      window.localStorage.removeItem(smsDraftKey);
      clearPhoto();
      await refresh(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); }
    finally { setSending(false); }
  }

  if (!open) return null;
  return <div className="chat-backdrop-v10" onMouseDown={onClose}>
    <section className="guest-chat-v10 guest-chat-v11 guest-chat-v13" onMouseDown={e => e.stopPropagation()} aria-label={`Chat with ${displayName}`}>
      <header className="guest-chat-head-v10">
        <div className="chat-avatar-v10"><MessageCircle size={19}/></div>
        <div><strong>Chat with {firstName}</strong><span>Private &amp; Secure Chat. • Messages and photos expire after 24 hours.</span></div>
        <button onClick={onClose} aria-label="Close chat"><X size={18}/></button>
      </header>

      <div className="guest-chat-messages-v10" ref={listRef}>
        {loading && !payload ? <div className="chat-loading-v10"><i/><i/><i/></div> : null}
        {!loading && payload && payload.messages.length === 0 ? <div className="chat-empty-v10"><MessageCircle/><strong>Start the conversation</strong><span>{effectiveForceSmsOnly ? "This conversation is set to mobile text. Type your message below and Veloura will prepare it in your phone’s Messages app." : "Send a private message or payment-proof photo, then continue by normal text whenever you prefer."}</span></div> : null}
        {payload?.messages.map(item => <article key={item.id} className={`chat-bubble-v10 ${item.sender_type === "VISITOR" ? "mine" : "theirs"}`}>
          {item.attachment_url && <a className="chat-photo-v11" href={item.attachment_url} target="_blank" rel="noreferrer"><img src={item.attachment_url} alt={item.attachment_name || "Chat photo"}/></a>}
          {(item.message && !(item.attachment_url && item.message === "Photo")) && <p>{item.message}</p>}
          <time>{formatTime(item.created_at)}</time>
        </article>)}
      </div>

      {payload?.thread.status === "BLOCKED" ? <div className="chat-blocked-v10">This private chat is no longer available.</div> : <form className="chat-compose-wrap-v11" onSubmit={sendMessage}>
        {!effectiveForceSmsOnly && photoPreview && <div className="chat-photo-preview-v11"><img src={photoPreview} alt="Selected payment proof"/><div><strong>{photo?.name}</strong><span>{photo ? `${(photo.size / 1024 / 1024).toFixed(1)} MB` : ""}</span></div><button type="button" onClick={clearPhoto} aria-label="Remove selected photo"><Trash2 size={15}/></button></div>}
        <div className={`chat-compose-v10 chat-compose-v11 ${effectiveForceSmsOnly ? "sms-only-v12" : ""}`}>
          {!effectiveForceSmsOnly && <><input ref={fileRef} className="chat-file-input-v11" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/><button type="button" className="chat-photo-btn-v11" onClick={() => fileRef.current?.click()} aria-label="Add photo"><ImagePlus size={18}/></button></>}
          <input value={draft} onChange={e => updateDraft(e.target.value)} maxLength={1000} autoComplete="off" placeholder={effectiveForceSmsOnly ? `Text ${firstName}…` : `Message ${firstName}…`} aria-label="Chat message"/>
          <button className="chat-send-btn-v11" disabled={sending || (!draft.trim() && !photo)} aria-label={effectiveForceSmsOnly ? "Open message in phone" : "Send message"}>{effectiveForceSmsOnly ? <Phone size={17}/> : <Send size={17}/>}</button>
        </div>
        <span className="chat-photo-help-v11">{effectiveForceSmsOnly ? "Send opens your phone’s Messages app with your typed text ready. Veloura cannot send the SMS automatically." : "JPG, PNG or WebP • max 4 MB • useful for payment proof"}</span>
      </form>}
      {handoffNotice && <div className="chat-handoff-note-v12">{handoffNotice}</div>}
      {error && <div className="chat-error-v10">{error}</div>}

      {!effectiveForceSmsOnly && smsHref && <a className="continue-sms-v10" href={smsHref}><Phone size={15}/><div><strong>Continue by Text</strong><span>Open your phone&apos;s Messages app and continue mobile-to-mobile.</span></div></a>}
    </section>
  </div>;
}
