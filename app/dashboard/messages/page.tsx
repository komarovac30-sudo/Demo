"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Ban, ChevronLeft, ImagePlus, LogOut, MessageCircle, Phone, RefreshCw, Send, Trash2, UnlockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Profile = { id: string; username: string; display_name: string; avatar_url: string | null };
type Thread = {
  id: string; guest_label: string; status: "ACTIVE" | "BLOCKED"; force_sms_only: boolean; created_at: string; last_activity_at: string;
  last_message: { message: string; created_at: string; sender_type: "VISITOR" | "CREATOR" } | null;
};
type Message = { id: number; sender_type: "VISITOR" | "CREATOR"; message: string; created_at: string; expires_at: string; attachment_url?: string | null; attachment_name?: string | null; attachment_mime?: string | null; attachment_size?: number | null };

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function relativeTime(value?: string | null) {
  if (!value) return "";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return "24h";
}
function clock(value: string) {
  try { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
  catch { return ""; }
}

export default function CreatorMessagesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadStatus, setThreadStatus] = useState<"ACTIVE" | "BLOCKED">("ACTIVE");
  const [threadForceSmsOnly, setThreadForceSmsOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null;
  }, []);

  const loadThreads = useCallback(async (silent = false) => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch("/api/chat/creator", { headers, cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load messages.");
      const next = (body.threads || []) as Thread[];
      setThreads(next);
      setSelected(prev => prev || next[0]?.id || "");
      if (!silent) setError("");
    } catch (err) { if (!silent) setError(err instanceof Error ? err.message : "Unable to load messages."); }
  }, [authHeaders]);

  const loadThread = useCallback(async (id: string, silent = false) => {
    if (!id) { setMessages([]); return; }
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(`/api/chat/creator/${encodeURIComponent(id)}`, { headers, cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load conversation.");
      setMessages((body.messages || []) as Message[]);
      setThreadStatus(body.thread?.status === "BLOCKED" ? "BLOCKED" : "ACTIVE");
      setThreadForceSmsOnly(Boolean(body.thread?.force_sms_only));
      setThreads(prev => prev.map(t => t.id === id ? { ...t, status: body.thread?.status === "BLOCKED" ? "BLOCKED" : "ACTIVE", force_sms_only: Boolean(body.thread?.force_sms_only) } : t));
      if (!silent) setError("");
    } catch (err) { if (!silent) setError(err instanceof Error ? err.message : "Unable to load conversation."); }
  }, [authHeaders]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setReady(true); return; }
      const { data } = await supabase.from("profiles").select("id,username,display_name,avatar_url,role").eq("id", user.id).maybeSingle();
      if (data?.role === "CREATOR") setProfile(data as Profile);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (profile) loadThreads(); }, [profile, loadThreads]);
  useEffect(() => {
    if (!selected) return;
    clearPhoto(); setReply(""); loadThread(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, loadThread]);
  useEffect(() => {
    if (!profile) return;
    const timer = window.setInterval(() => loadThreads(true), 10000);
    return () => window.clearInterval(timer);
  }, [profile, loadThreads]);
  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => loadThread(selected, true), 8000);
    return () => window.clearInterval(timer);
  }, [selected, loadThread]);
  useEffect(() => {
    window.setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, [messages.length, selected]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null); setPhotoPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function choosePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setError("");
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) { setError("Use a JPG, PNG, or WebP image."); e.target.value = ""; return; }
    if (file.size > MAX_PHOTO_BYTES) { setError("Photo must be 4 MB or smaller."); e.target.value = ""; return; }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file); setPhotoPreview(URL.createObjectURL(file));
  }

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || threadStatus === "BLOCKED" || (!reply.trim() && !photo)) return;
    setBusy(true); setError("");
    try {
      const headers = await authHeaders(); if (!headers) throw new Error("Please sign in again.");
      let res: Response;
      if (photo) {
        const fd = new FormData();
        fd.set("message", reply.trim());
        fd.set("attachment", photo);
        res = await fetch(`/api/chat/creator/${encodeURIComponent(selected)}`, { method: "POST", headers, body: fd });
      } else {
        res = await fetch(`/api/chat/creator/${encodeURIComponent(selected)}`, {
          method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ message: reply.trim() }),
        });
      }
      const body = await res.json(); if (!res.ok) throw new Error(body.error || "Unable to send message.");
      setReply(""); clearPhoto(); await Promise.all([loadThread(selected, true), loadThreads(true)]);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send message."); }
    finally { setBusy(false); }
  }

  async function toggleBlock() {
    if (!selected) return;
    const next = threadStatus === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    if (next === "BLOCKED" && !confirm("Block this visitor chat? They will no longer be able to send web messages.")) return;
    setBusy(true); setError("");
    try {
      const headers = await authHeaders(); if (!headers) throw new Error("Please sign in again.");
      const res = await fetch(`/api/chat/creator/${encodeURIComponent(selected)}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const body = await res.json(); if (!res.ok) throw new Error(body.error || "Unable to update chat.");
      setThreadStatus(next); setThreads(prev => prev.map(t => t.id === selected ? { ...t, status: next } : t));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update chat."); }
    finally { setBusy(false); }
  }

  async function setVisitorMode(forceSmsOnly: boolean) {
    if (!selected || modeBusy || forceSmsOnly === threadForceSmsOnly) return;
    setModeBusy(true); setError("");
    try {
      const headers = await authHeaders(); if (!headers) throw new Error("Please sign in again.");
      const res = await fetch(`/api/chat/creator/${encodeURIComponent(selected)}`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ force_sms_only: forceSmsOnly }),
      });
      const body = await res.json(); if (!res.ok) throw new Error(body.error || "Unable to update visitor message mode.");
      setThreadForceSmsOnly(Boolean(body.force_sms_only));
      setThreads(prev => prev.map(t => t.id === selected ? { ...t, force_sms_only: Boolean(body.force_sms_only) } : t));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update visitor message mode."); }
    finally { setModeBusy(false); }
  }

  async function logout() { await supabase.auth.signOut(); window.location.href = "/login"; }
  const activeThread = useMemo(() => threads.find(t => t.id === selected) || null, [threads, selected]);

  if (!ready) return <div className="chat-page-loading-v10"><div/><div/></div>;
  if (!profile) return <div className="center-screen"><div className="friendly-error"><h2>ES Studio access required</h2><Link className="btn primary" href="/login">Go to login</Link></div></div>;

  return <main className="dashboard-page-v5">
    <aside className="dashboard-sidebar-v5">
      <Link href="/" className="veloura-brand"><span>V</span>VELOURA</Link><div className="workspace-label">ES Studio</div>
      <nav><Link href="/dashboard">Home</Link><Link href="/dashboard#profile">My profile</Link><Link href="/dashboard#post">Add to my gallery</Link><Link href="/dashboard#library">My gallery</Link><Link href="/dashboard#reviews">Client reviews</Link><Link className="active" href="/dashboard/messages">Messages</Link><Link href="/dashboard/visitors">Profile visitors</Link></nav>
      <div className="sidebar-user-v5"><img src={profile.avatar_url || "/demo/avatar-v5.svg"} alt=""/><div><strong>{profile.display_name}</strong><span>@{profile.username}</span></div></div>
      <button className="sidebar-logout" onClick={logout}><LogOut size={17}/> Log out</button>
    </aside>

    <section className="dashboard-content-v5 chat-workspace-v10">
      <header className="workspace-header-v5 chat-workspace-header-v13">
        <div><span className="workspace-kicker"><MessageCircle size={14}/> PRIVATE &amp; SECURE CHAT</span><h1>Messages</h1><p>Messages and photos expire after 24 hours. Set Web Chat or Force Text separately for each visitor.</p></div>
        <button className="btn secondary" onClick={() => { loadThreads(); if (selected) loadThread(selected); }}><RefreshCw size={16}/> Refresh</button>
      </header>

      {error && <div className="alert error">{error}</div>}

      <div className="chat-studio-grid-v10 chat-studio-grid-v12 chat-studio-grid-v13">
        <aside className="chat-thread-list-v10">
          <div className="chat-thread-title-v10"><strong>Conversations</strong><span>{threads.length} active/recent</span></div>
          {threads.length === 0 ? <div className="chat-studio-empty-v10"><MessageCircle/><strong>No messages yet</strong><span>New visitor chats will appear here automatically.</span></div> : threads.map(t => <button key={t.id} className={selected === t.id ? "active" : ""} onClick={() => setSelected(t.id)}>
            <span className="thread-avatar-v10">{t.guest_label.replace("Guest ", "").slice(0, 2)}</span>
            <div><strong>{t.guest_label}</strong><span>{t.last_message?.message || "Conversation started"}</span>{t.force_sms_only && <small className="thread-mode-label-v13">Force Text</small>}</div>
            <time>{relativeTime(t.last_message?.created_at || t.last_activity_at)}</time>
            {t.status === "BLOCKED" && <em>Blocked</em>}
          </button>)}
        </aside>

        <section className="creator-chat-panel-v10 creator-chat-panel-v12 creator-chat-panel-v13">
          {!activeThread ? <div className="chat-studio-empty-v10 large"><MessageCircle/><strong>Select a conversation</strong><span>Private visitor conversations are shown here.</span></div> : <>
            <header className="creator-thread-head-v13">
              <div className="creator-thread-person-v13"><button className="chat-mobile-back-v10" onClick={() => setSelected("")}><ChevronLeft/></button><span className="thread-avatar-v10">{activeThread.guest_label.replace("Guest ", "").slice(0, 2)}</span><div><strong>{activeThread.guest_label}</strong><span>Private visitor conversation</span></div></div>
              <div className="creator-thread-controls-v13">
                <div className="thread-mode-toggle-v13" role="radiogroup" aria-label={`Message mode for ${activeThread.guest_label}`}>
                  <button type="button" role="radio" aria-checked={!threadForceSmsOnly} className={!threadForceSmsOnly ? "active" : ""} disabled={modeBusy} onClick={() => setVisitorMode(false)}><MessageCircle size={13}/> Web Chat</button>
                  <button type="button" role="radio" aria-checked={threadForceSmsOnly} className={threadForceSmsOnly ? "active" : ""} disabled={modeBusy} onClick={() => setVisitorMode(true)}><Phone size={13}/> Force Text</button>
                </div>
                <button className={`chat-block-btn-v10 ${threadStatus === "BLOCKED" ? "unblock" : ""}`} onClick={toggleBlock} disabled={busy}>{threadStatus === "BLOCKED" ? <><UnlockKeyhole size={14}/> Unblock</> : <><Ban size={14}/> Block</>}</button>
              </div>
            </header>
            <div className="creator-chat-messages-v10" ref={listRef}>
              {messages.length === 0 ? <div className="chat-studio-empty-v10"><MessageCircle/><strong>No recent messages</strong><span>Older web messages may already have expired.</span></div> : messages.map(m => <article key={m.id} className={`chat-bubble-v10 ${m.sender_type === "CREATOR" ? "mine" : "theirs"}`}>{m.attachment_url && <a className="chat-photo-v11" href={m.attachment_url} target="_blank" rel="noreferrer"><img src={m.attachment_url} alt={m.attachment_name || "Chat photo"}/></a>}{!(m.attachment_url && m.message === "Photo") && <p>{m.message}</p>}<time>{clock(m.created_at)}</time></article>)}
            </div>
            {threadStatus === "BLOCKED" ? <div className="chat-blocked-v10 creator">This visitor is blocked. Unblock them to continue chatting.</div> : <form className="creator-compose-wrap-v13" onSubmit={send}>
              {photoPreview && <div className="chat-photo-preview-v11 creator-photo-preview-v13"><img src={photoPreview} alt="Selected chat photo"/><div><strong>{photo?.name}</strong><span>{photo ? `${(photo.size / 1024 / 1024).toFixed(1)} MB` : ""}</span></div><button type="button" onClick={clearPhoto} aria-label="Remove selected photo"><Trash2 size={15}/></button></div>}
              <div className="chat-compose-v10 chat-compose-v11 creator chat-compose-creator-v12 chat-compose-creator-v13">
                <input ref={fileRef} className="chat-file-input-v11" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/>
                <button type="button" className="chat-photo-btn-v11" onClick={() => fileRef.current?.click()} aria-label="Add photo"><ImagePlus size={18}/></button>
                <input value={reply} onChange={e => setReply(e.target.value)} maxLength={1000} autoComplete="off" placeholder={`Reply to ${activeThread.guest_label}…`}/>
                <button className="chat-send-btn-v11" disabled={busy || (!reply.trim() && !photo)} aria-label="Send reply"><Send size={17}/></button>
              </div>
              <span className="chat-photo-help-v11 creator-photo-help-v13">JPG, PNG or WebP • max 4 MB • messages and photos expire after 24 hours</span>
            </form>}
          </>}
        </section>
      </div>
    </section>
  </main>;
}
