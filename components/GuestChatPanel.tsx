"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, MessageCircle, Phone, Send, ShieldCheck, Trash2, X } from "lucide-react";

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
type ChatPayload = { thread: { id: string; label: string; status: "ACTIVE" | "BLOCKED" }; messages: ChatMessage[]; retention_hours: number };

type Props = {
  creatorId: string;
  displayName: string;
  phone?: string | null;
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

export default function GuestChatPanel({ creatorId, displayName, phone, open, onClose, initialMessage = "" }: Props) {
  const [token, setToken] = useState("");
  const [payload, setPayload] = useState<ChatPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const firstName = useMemo(() => displayName.split(" ")[0] || displayName, [displayName]);
  const smsHref = useMemo(() => {
    if (!phone) return "";
    const cleaned = phone.replace(/[^+\d]/g, "");
    const body = encodeURIComponent(`Hi ${firstName}, I found your Veloura profile and would like to continue our conversation.`);
    return `sms:${cleaned}?body=${body}`;
  }, [phone, firstName]);

  useEffect(() => {
    if (!open) return;
    setToken(ensureGuestToken());
    if (initialMessage) setDraft(initialMessage);
  }, [open, initialMessage]);

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

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
    if (!file) return;
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

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || payload?.thread.status === "BLOCKED") return;
    const message = draft.trim();
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
      if (!res.ok) throw new Error(body.error || "Unable to send message.");
      setDraft("");
      clearPhoto();
      await refresh(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); }
    finally { setSending(false); }
  }

  if (!open) return null;
  return <div className="chat-backdrop-v10" onMouseDown={onClose}>
    <section className="guest-chat-v10 guest-chat-v11" onMouseDown={e => e.stopPropagation()} aria-label={`Chat with ${displayName}`}>
      <header className="guest-chat-head-v10">
        <div className="chat-avatar-v10"><MessageCircle size={19}/></div>
        <div><strong>Chat with {firstName}</strong><span>Simple private web chat • messages and photos expire after 24 hours</span></div>
        <button onClick={onClose} aria-label="Close chat"><X size={18}/></button>
      </header>

      <div className="chat-retention-note-v10"><ShieldCheck size={14}/><span>Temporary chat: messages and payment-proof photos disappear after 24 hours.</span></div>

      <div className="guest-chat-messages-v10" ref={listRef}>
        {loading && !payload ? <div className="chat-loading-v10"><i/><i/><i/></div> : null}
        {!loading && payload && payload.messages.length === 0 ? <div className="chat-empty-v10"><MessageCircle/><strong>Start the conversation</strong><span>Send a short message or payment-proof photo, then continue by normal text whenever you prefer.</span></div> : null}
        {payload?.messages.map(item => <article key={item.id} className={`chat-bubble-v10 ${item.sender_type === "VISITOR" ? "mine" : "theirs"}`}>
          {item.attachment_url && <a className="chat-photo-v11" href={item.attachment_url} target="_blank" rel="noreferrer"><img src={item.attachment_url} alt={item.attachment_name || "Chat photo"}/></a>}
          {(item.message && !(item.attachment_url && item.message === "Photo")) && <p>{item.message}</p>}
          <time>{formatTime(item.created_at)}</time>
        </article>)}
      </div>

      {payload?.thread.status === "BLOCKED" ? <div className="chat-blocked-v10">This temporary chat is no longer available.</div> : <form className="chat-compose-wrap-v11" onSubmit={sendMessage}>
        {photoPreview && <div className="chat-photo-preview-v11"><img src={photoPreview} alt="Selected payment proof"/><div><strong>{photo?.name}</strong><span>{photo ? `${(photo.size / 1024 / 1024).toFixed(1)} MB` : ""}</span></div><button type="button" onClick={clearPhoto} aria-label="Remove selected photo"><Trash2 size={15}/></button></div>}
        <div className="chat-compose-v10 chat-compose-v11">
          <input ref={fileRef} className="chat-file-input-v11" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/>
          <button type="button" className="chat-photo-btn-v11" onClick={() => fileRef.current?.click()} aria-label="Add photo"><ImagePlus size={18}/></button>
          <input value={draft} onChange={e => setDraft(e.target.value)} maxLength={1000} autoComplete="off" placeholder={`Message ${firstName}…`} aria-label="Chat message"/>
          <button className="chat-send-btn-v11" disabled={sending || (!draft.trim() && !photo)} aria-label="Send message"><Send size={17}/></button>
        </div>
        <span className="chat-photo-help-v11">JPG, PNG or WebP • max 4 MB • useful for payment proof</span>
      </form>}
      {error && <div className="chat-error-v10">{error}</div>}

      {smsHref && <a className="continue-sms-v10" href={smsHref}><Phone size={15}/><div><strong>Continue by Text</strong><span>Open your phone&apos;s Messages app and continue mobile-to-mobile.</span></div></a>}
    </section>
  </div>;
}
