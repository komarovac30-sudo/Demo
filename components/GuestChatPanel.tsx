"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Phone, Send, ShieldCheck, X } from "lucide-react";

type ChatMessage = { id: number; sender_type: "VISITOR" | "CREATOR"; message: string; created_at: string; expires_at: string };
type ChatPayload = { thread: { id: string; label: string; status: "ACTIVE" | "BLOCKED" }; messages: ChatMessage[]; retention_hours: number };

type Props = {
  creatorId: string;
  displayName: string;
  phone?: string | null;
  open: boolean;
  onClose: () => void;
};

const POLL_MS = 8000;

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

export default function GuestChatPanel({ creatorId, displayName, phone, open, onClose }: Props) {
  const [token, setToken] = useState("");
  const [payload, setPayload] = useState<ChatPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

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
  }, [open]);

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

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || payload?.thread.status === "BLOCKED") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const message = String(fd.get("message") || "").trim();
    if (!message) return;
    setSending(true); setError("");
    try {
      const res = await fetch("/api/chat/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": token },
        body: JSON.stringify({ creator_id: creatorId, message }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to send message.");
      form.reset();
      await refresh(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); }
    finally { setSending(false); }
  }

  if (!open) return null;
  return <div className="chat-backdrop-v10" onMouseDown={onClose}>
    <section className="guest-chat-v10" onMouseDown={e => e.stopPropagation()} aria-label={`Chat with ${displayName}`}>
      <header className="guest-chat-head-v10">
        <div className="chat-avatar-v10"><MessageCircle size={19}/></div>
        <div><strong>Chat with {firstName}</strong><span>Simple private web chat • messages expire after 24 hours</span></div>
        <button onClick={onClose} aria-label="Close chat"><X size={18}/></button>
      </header>

      <div className="chat-retention-note-v10"><ShieldCheck size={14}/><span>This is temporary chat. Messages are automatically removed after 24 hours.</span></div>

      <div className="guest-chat-messages-v10" ref={listRef}>
        {loading && !payload ? <div className="chat-loading-v10"><i/><i/><i/></div> : null}
        {!loading && payload && payload.messages.length === 0 ? <div className="chat-empty-v10"><MessageCircle/><strong>Start the conversation</strong><span>Send a short message here, then continue by normal text whenever you prefer.</span></div> : null}
        {payload?.messages.map(item => <article key={item.id} className={`chat-bubble-v10 ${item.sender_type === "VISITOR" ? "mine" : "theirs"}`}>
          <p>{item.message}</p><time>{formatTime(item.created_at)}</time>
        </article>)}
      </div>

      {payload?.thread.status === "BLOCKED" ? <div className="chat-blocked-v10">This temporary chat is no longer available.</div> : <form className="chat-compose-v10" onSubmit={sendMessage}>
        <input name="message" maxLength={1000} autoComplete="off" placeholder={`Message ${firstName}…`} aria-label="Chat message"/>
        <button disabled={sending} aria-label="Send message"><Send size={17}/></button>
      </form>}
      {error && <div className="chat-error-v10">{error}</div>}

      {smsHref && <a className="continue-sms-v10" href={smsHref}><Phone size={15}/><div><strong>Continue by Text</strong><span>Open your phone's Messages app and continue mobile-to-mobile.</span></div></a>}
    </section>
  </div>;
}
