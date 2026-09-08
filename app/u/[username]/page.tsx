"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Heart, LockKeyhole, LogIn, Play, Star, Unlock, X } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Media = { id: string; type: "PHOTO"|"VIDEO"; visibility: "PUBLIC"|"LOCKED"; title: string|null; media_url: string|null; locked: boolean };
type Review = { id: string; reviewer_name: string; rating: number; review_text: string; is_featured: boolean };
type Payload = { profile: { id:string; username:string; display_name:string; bio:string|null; avatar_url:string|null; cover_url:string|null }; media: Media[]; reviews: Review[]; unlocked: boolean };

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>(); const username = params.username;
  const [data, setData] = useState<Payload|null>(null); const [loading, setLoading] = useState(true); const [modal, setModal] = useState(false); const [message, setMessage] = useState(""); const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/public/profile/${encodeURIComponent(username)}`, { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
    if (!res.ok) { setData(null); setLoading(false); return; }
    const body: Payload = await res.json(); setData(body); setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!data?.profile.id) return; track("PROFILE_VIEW"); if (data.media.some(m => m.locked)) track("LOCKED_CONTENT_SEEN"); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.profile.id]);

  async function track(event_type: string, media_id?: string) {
    if (!data?.profile.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("activity_events").insert({ profile_id: data.profile.id, visitor_id: user?.id || null, media_id: media_id || null, event_type, metadata: { page: "public-profile" } });
  }

  async function unlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!data) return; setUnlocking(true); setMessage(""); await track("UNLOCK_CLICK");
    const form = new FormData(e.currentTarget); const email = String(form.get("email") || ""); const password = String(form.get("password") || "");
    let result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      const reg = await fetch("/api/auth/demo-register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const regBody = await reg.json();
      if (!reg.ok) { setMessage(reg.status === 409 ? "This email already exists. Check the demo-site password." : (regBody.error || "Could not create demo account.")); setUnlocking(false); return; }
      result = await supabase.auth.signInWithPassword({ email, password });
    }
    if (result.error || !result.data.user) { setMessage(result.error?.message || "Unable to sign in."); setUnlocking(false); return; }
    const { error } = await supabase.from("profile_unlocks").upsert({ visitor_id: result.data.user.id, creator_id: data.profile.id }, { onConflict: "visitor_id,creator_id" });
    if (error) { setMessage(error.message); setUnlocking(false); return; }
    await track("UNLOCK_SUCCESS"); setModal(false); setUnlocking(false); await load();
  }

  const publicCount = useMemo(() => data?.media.filter(m => !m.locked).length || 0, [data]);
  const lockedCount = useMemo(() => data?.media.filter(m => m.visibility === "LOCKED").length || 0, [data]);

  if (loading) return <div className="center-screen">Loading creator profile…</div>;
  if (!data) return <div className="center-screen"><div><h2>Creator not found</h2><Link className="btn primary" href="/">Back home</Link></div></div>;

  return (
    <main className="profile-page">
      <header className="public-nav"><Link href="/" className="brand">CreatorSpace<span>Demo</span></Link><Link href="/login" className="btn ghost"><LogIn size={16}/> Login</Link></header>
      <div className="profile-shell">
        <div className="cover" style={data.profile.cover_url ? { backgroundImage: `url(${data.profile.cover_url})` } : undefined} />
        <section className="profile-head">
          <div className="avatar-wrap"><img src={data.profile.avatar_url || "/demo/avatar.svg"} alt={data.profile.display_name} /></div>
          <div className="profile-copy"><h1>{data.profile.display_name}<span className="verified">✓</span></h1><span className="handle">@{data.profile.username}</span><p>{data.profile.bio || "A clean demo creator profile with public and locked media."}</p><div className="profile-stats"><span><strong>{publicCount}</strong> public</span><span><strong>{lockedCount}</strong> locked</span><span><strong>{data.reviews.length}</strong> reviews</span></div></div>
          {!data.unlocked && lockedCount > 0 && <button className="btn primary unlock-top" onClick={() => { setModal(true); track("UNLOCK_CLICK"); }}><Unlock size={17}/> Unlock profile</button>}
          {data.unlocked && <span className="pill success unlock-top"><Unlock size={14}/> Unlocked</span>}
        </section>

        <div className="profile-tabs"><span className="active">Posts</span><span>Media</span><span>Reviews</span><span>About</span></div>

        <section className="feed">
          {data.media.length === 0 && <div className="empty-state">No media has been published yet.</div>}
          {data.media.map(item => (
            <article className="post-card" key={item.id}>
              <div className="post-meta"><img src={data.profile.avatar_url || "/demo/avatar.svg"} alt=""/><div><strong>{data.profile.display_name}</strong><span>@{data.profile.username}</span></div><span className="post-badge">{item.visibility}</span></div>
              {item.locked ? <button className="locked-media" onClick={() => { setModal(true); track("UNLOCK_CLICK", item.id); }}><div className="lock-orb"><LockKeyhole/></div><h3>Locked content</h3><p>Create or sign in to a demo account to view this post.</p><span className="btn primary">Unlock to view</span></button> : item.type === "VIDEO" ? <video className="post-media" src={item.media_url || ""} controls onPlay={() => track("VIDEO_PLAY", item.id)} /> : <img className="post-media" src={item.media_url || ""} alt={item.title || "Creator post"} onClick={() => track("PHOTO_VIEW", item.id)} />}
              <div className="post-body"><div className="post-actions"><Heart size={20}/>{item.type === "VIDEO" && <Play size={20}/>}</div><strong>{item.title || "New post"}</strong></div>
            </article>
          ))}
        </section>

        <section className="reviews-section"><div className="section-heading"><div><div className="eyebrow"><Star size={15}/> Reviews</div><h2>What people are saying</h2></div></div><div className="review-grid">{data.reviews.map(r => <article className="review-card" key={r.id}><div className="stars">{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</div><p>“{r.review_text}”</p><strong>{r.reviewer_name}</strong>{r.is_featured && <span className="pill">Featured</span>}</article>)}</div></section>
      </div>

      {modal && <div className="modal-backdrop"><div className="modal-card"><button className="modal-close" onClick={() => setModal(false)}><X/></button><div className="lock-orb"><Unlock/></div><h2>Unlock {data.profile.display_name}</h2><p className="muted">Enter an email and a password for this demo site. If the email is new, a Visitor account is created automatically.</p><form className="form-stack" onSubmit={unlock}><label>Email<input name="email" type="email" required placeholder="visitor@example.com" /></label><label>Demo-site password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters" /></label>{message && <div className="alert error">{message}</div>}<button className="btn primary wide" disabled={unlocking}>{unlocking ? "Unlocking…" : "Unlock content"}</button></form><p className="tiny muted">This demo never asks for a Gmail, Facebook or other external account password.</p></div></div>}
    </main>
  );
}
