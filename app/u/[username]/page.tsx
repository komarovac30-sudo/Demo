"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Heart, Images, LockKeyhole, LogIn, MapPin, MessageSquareText, Play, Star, Unlock, Video, X } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Media = {
  id: string;
  type: "PHOTO" | "VIDEO";
  visibility: "PUBLIC" | "LOCKED";
  title: string | null;
  media_url: string | null;
  locked: boolean;
  likes_count?: number;
  liked_by_me?: boolean;
};
type Review = { id: string; reviewer_name: string; rating: number; review_text: string; is_featured: boolean };
type Payload = {
  profile: { id: string; username: string; display_name: string; bio: string | null; avatar_url: string | null; cover_url: string | null };
  media: Media[];
  reviews: Review[];
  unlocked: boolean;
};
type VisitorContext = {
  city: string | null;
  country: string | null;
  region: string | null;
  location_source?: string;
  device_type: string;
  browser: string;
  os: string;
};
type AuthPurpose = { kind: "unlock" } | { kind: "like"; mediaId: string };

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPurpose, setAuthPurpose] = useState<AuthPurpose | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [visitorContext, setVisitorContext] = useState<VisitorContext | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/public/profile/${encodeURIComponent(username)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) { setData(null); setLoading(false); return; }
    const body: Payload = await res.json();
    setData(body);
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data?.profile.id) return;
    track("PROFILE_VIEW").then(context => { if (context) setVisitorContext(context); });
    if (data.media.some(m => m.locked)) track("LOCKED_CONTENT_SEEN");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.profile.id]);

  async function track(event_type: string, media_id?: string): Promise<VisitorContext | null> {
    if (!data?.profile.id) return null;
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ profile_id: data.profile.id, media_id: media_id || null, event_type }),
      });
      if (!res.ok) return null;
      const body = await res.json();
      return body.context || null;
    } catch {
      return null;
    }
  }

  async function signInOrCreate(email: string, password: string) {
    let result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      const reg = await fetch("/api/auth/demo-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const regBody = await reg.json();
      if (!reg.ok) throw new Error(reg.status === 409 ? "This email already exists. Check the demo-site password." : (regBody.error || "Could not create demo account."));
      result = await supabase.auth.signInWithPassword({ email, password });
    }
    if (result.error || !result.data.user || !result.data.session) throw new Error(result.error?.message || "Unable to sign in.");
    return result.data.session.access_token;
  }

  async function submitAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data || !authPurpose) return;
    setAuthBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      const accessToken = await signInOrCreate(email, password);
      if (authPurpose.kind === "unlock") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unable to read visitor account.");
        const { error } = await supabase.from("profile_unlocks").upsert(
          { visitor_id: user.id, creator_id: data.profile.id },
          { onConflict: "visitor_id,creator_id" },
        );
        if (error) throw error;
        await track("UNLOCK_SUCCESS");
        setAuthPurpose(null);
        setNotice("Profile unlocked.");
        await load();
      } else {
        const mediaId = authPurpose.mediaId;
        setAuthPurpose(null);
        await toggleLike(mediaId, accessToken);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to continue.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function toggleLike(mediaId: string, forcedToken?: string) {
    const item = data?.media.find(m => m.id === mediaId);
    if (!item || item.locked) {
      if (item?.locked) setAuthPurpose({ kind: "unlock" });
      return;
    }

    let token = forcedToken || "";
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || "";
    }
    if (!token) {
      setMessage("");
      setAuthPurpose({ kind: "like", mediaId });
      return;
    }

    setLikingIds(prev => new Set(prev).add(mediaId));
    setNotice("");
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to update like.");
      setData(prev => prev ? {
        ...prev,
        media: prev.media.map(m => m.id === mediaId ? { ...m, liked_by_me: Boolean(body.liked), likes_count: Number(body.likes_count || 0) } : m),
      } : prev);
      setNotice(body.liked ? "Liked." : "Like removed.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to update like.");
    } finally {
      setLikingIds(prev => { const next = new Set(prev); next.delete(mediaId); return next; });
    }
  }

  const lockedCount = useMemo(() => data?.media.filter(m => m.visibility === "LOCKED").length || 0, [data]);
  const totalLikes = useMemo(() => data?.media.reduce((sum, item) => sum + Number(item.likes_count || 0), 0) || 0, [data]);
  const photoCount = useMemo(() => data?.media.filter(m => m.type === "PHOTO").length || 0, [data]);
  const videoCount = useMemo(() => data?.media.filter(m => m.type === "VIDEO").length || 0, [data]);
  const visitorCity = visitorContext?.city || visitorContext?.region || visitorContext?.country || (visitorContext ? "Unknown" : "Locating…");

  if (loading) return <div className="center-screen">Loading creator profile…</div>;
  if (!data) return <div className="center-screen"><div><h2>Creator not found</h2><Link className="btn primary" href="/">Back home</Link></div></div>;

  const modalIsLike = authPurpose?.kind === "like";

  return (
    <main className="profile-page">
      <header className="public-nav"><Link href="/" className="brand">CreatorSpace<span>Demo</span></Link><Link href="/login" className="btn ghost"><LogIn size={16}/> Login</Link></header>
      <div className="profile-shell">
        <div className="cover" style={data.profile.cover_url ? { backgroundImage: `url(${data.profile.cover_url})` } : undefined} />
        <section className="profile-head">
          <div className="avatar-wrap"><img src={data.profile.avatar_url || "/demo/avatar.svg"} alt={data.profile.display_name} /></div>
          <div className="profile-copy">
            <h1>{data.profile.display_name}<span className="verified">✓</span></h1>
            <span className="handle">@{data.profile.username}</span>
            <p>{data.profile.bio || "A clean demo creator profile with public and locked media."}</p>
            <div className="profile-quick-stats" aria-label="Profile quick stats">
              <span className="quick-stat"><Heart size={15}/><strong>{totalLikes}</strong><em>likes</em></span>
              <span className="quick-stat"><Images size={15}/><strong>{photoCount}</strong><em>photos</em></span>
              <span className="quick-stat"><Video size={15}/><strong>{videoCount}</strong><em>videos</em></span>
              <span className="quick-stat location-stat" title={`Approximate visitor location based on IP${visitorContext?.location_source ? ` • ${visitorContext.location_source}` : ""}`}><MapPin size={15}/><strong>{visitorCity}</strong><span className="location-active-dot" aria-label="Location active"/></span>
              <span className="quick-stat"><MessageSquareText size={15}/><strong>{data.reviews.length}</strong><em>reviews</em></span>
            </div>
          </div>
          {!data.unlocked && lockedCount > 0 && <button className="btn primary unlock-top" onClick={() => { setMessage(""); setAuthPurpose({ kind: "unlock" }); track("UNLOCK_CLICK"); }}><Unlock size={17}/> Unlock profile</button>}
          {data.unlocked && <span className="pill success unlock-top"><Unlock size={14}/> Unlocked</span>}
        </section>

        <div className="profile-tabs"><span className="active">Posts</span><span>Media</span><span>Reviews</span><span>About</span></div>
        {notice && <div className="profile-notice">{notice}</div>}

        <section className="feed">
          {data.media.length === 0 && <div className="empty-state">No media has been published yet.</div>}
          {data.media.map(item => (
            <article className="post-card" key={item.id}>
              <div className="post-meta"><img src={data.profile.avatar_url || "/demo/avatar.svg"} alt=""/><div><strong>{data.profile.display_name}</strong><span>@{data.profile.username}</span></div><span className="post-badge">{item.visibility}</span></div>
              {item.locked ? <button className="locked-media" onClick={() => { setMessage(""); setAuthPurpose({ kind: "unlock" }); track("UNLOCK_CLICK", item.id); }}><div className="lock-orb"><LockKeyhole/></div><h3>Locked content</h3><p>Create or sign in to a demo account to view this post.</p><span className="btn primary">Unlock to view</span></button> : item.type === "VIDEO" ? <video className="post-media" src={item.media_url || ""} controls onPlay={() => track("VIDEO_PLAY", item.id)} /> : <img className="post-media" src={item.media_url || ""} alt={item.title || "Creator post"} onClick={() => track("PHOTO_VIEW", item.id)} />}
              <div className="post-body"><div className="post-actions">{item.locked ? <span className="media-like-count"><Heart size={20}/><strong>{Number(item.likes_count || 0)}</strong></span> : <button className={`media-like-button ${item.liked_by_me ? "liked" : ""}`} disabled={likingIds.has(item.id)} onClick={() => toggleLike(item.id)} aria-pressed={Boolean(item.liked_by_me)} title={item.liked_by_me ? "Remove like" : "Like this post"}><Heart size={20} fill={item.liked_by_me ? "currentColor" : "none"}/><strong>{Number(item.likes_count || 0)}</strong></button>}{item.type === "VIDEO" && <Play size={20}/>}</div><strong>{item.title || "New post"}</strong></div>
            </article>
          ))}
        </section>

        <section className="reviews-section"><div className="section-heading"><div><div className="eyebrow"><Star size={15}/> Reviews</div><h2>What people are saying</h2></div></div><div className="review-grid">{data.reviews.map(r => <article className="review-card" key={r.id}><div className="stars">{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</div><p>“{r.review_text}”</p><strong>{r.reviewer_name}</strong>{r.is_featured && <span className="pill">Featured</span>}</article>)}</div></section>
      </div>

      {authPurpose && <div className="modal-backdrop"><div className="modal-card"><button className="modal-close" onClick={() => { setAuthPurpose(null); setMessage(""); }}><X/></button><div className="lock-orb">{modalIsLike ? <Heart/> : <Unlock/>}</div><h2>{modalIsLike ? "Sign in to like" : `Unlock ${data.profile.display_name}`}</h2><p className="muted">{modalIsLike ? "Enter an email and demo-site password. If the email is new, a Visitor account is created automatically. Liking a public post does not unlock private content." : "Enter an email and a password for this demo site. If the email is new, a Visitor account is created automatically."}</p><form className="form-stack" onSubmit={submitAuth}><label>Email<input name="email" type="email" required placeholder="visitor@example.com" /></label><label>Demo-site password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters" /></label>{message && <div className="alert error">{message}</div>}<button className="btn primary wide" disabled={authBusy}>{authBusy ? "Please wait…" : (modalIsLike ? "Continue & like" : "Unlock content")}</button></form><p className="tiny muted">This demo never asks for a Gmail, Facebook or other external account password.</p></div></div>}
    </main>
  );
}
