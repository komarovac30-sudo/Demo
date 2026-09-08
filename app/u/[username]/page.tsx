"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Heart, Images, LockKeyhole, LogIn, MapPin, MessageSquareText, MoreHorizontal, Play, Share2, Star, Unlock, Video, X } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Media = {
  id: string;
  type: "PHOTO" | "VIDEO";
  visibility: "PUBLIC" | "LOCKED";
  title: string | null;
  description?: string | null;
  media_url: string | null;
  thumbnail_url?: string | null;
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
type VisitorContext = { city: string | null; country: string | null; region: string | null; location_source?: string; device_type: string; browser: string; os: string };
type AuthPurpose = { kind: "unlock" } | { kind: "like"; mediaId: string };
type Tab = "media" | "reviews" | "about";

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPurpose, setAuthPurpose] = useState<AuthPurpose | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [visitorContext, setVisitorContext] = useState<VisitorContext | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("media");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/public/profile/${encodeURIComponent(username)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}, cache: "no-store",
    });
    if (!res.ok) { setData(null); setLoading(false); return; }
    setData(await res.json() as Payload); setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data?.profile.id) return;
    track("PROFILE_VIEW").then(context => { if (context) setVisitorContext(context); });
    if (data.media.some(m => m.visibility === "LOCKED" && m.locked)) track("LOCKED_CONTENT_SEEN");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.profile.id]);

  async function track(event_type: string, media_id?: string): Promise<VisitorContext | null> {
    if (!data?.profile.id) return null;
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/activity", {
        method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ profile_id: data.profile.id, media_id: media_id || null, event_type }),
      });
      if (!res.ok) return null;
      const body = await res.json(); return body.context || null;
    } catch { return null; }
  }

  async function signInOrCreate(email: string, password: string) {
    let result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      const reg = await fetch("/api/auth/demo-register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const regBody = await reg.json();
      if (!reg.ok) throw new Error(reg.status === 409 ? "This email already exists. Check the demo-site password." : (regBody.error || "Could not create demo account."));
      result = await supabase.auth.signInWithPassword({ email, password });
    }
    if (result.error || !result.data.user || !result.data.session) throw new Error(result.error?.message || "Unable to sign in.");
    return result.data.session.access_token;
  }

  async function submitAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!data || !authPurpose) return;
    setAuthBusy(true); setMessage("");
    const form = new FormData(e.currentTarget); const email = String(form.get("email") || ""); const password = String(form.get("password") || "");
    try {
      const accessToken = await signInOrCreate(email, password);
      if (authPurpose.kind === "unlock") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unable to read visitor account.");
        const { error } = await supabase.from("profile_unlocks").upsert({ visitor_id: user.id, creator_id: data.profile.id }, { onConflict: "visitor_id,creator_id" });
        if (error) throw error;
        await track("UNLOCK_SUCCESS"); setAuthPurpose(null); setNotice("Exclusive content unlocked."); await load();
      } else {
        const mediaId = authPurpose.mediaId; setAuthPurpose(null); await toggleLike(mediaId, accessToken);
      }
    } catch (err) { setMessage(err instanceof Error ? err.message : "Unable to continue."); }
    finally { setAuthBusy(false); }
  }

  async function toggleLike(mediaId: string, forcedToken?: string) {
    const item = data?.media.find(m => m.id === mediaId);
    if (!item || item.locked) { if (item?.locked) openUnlock(item.id); return; }
    let token = forcedToken || "";
    if (!token) { const { data: { session } } = await supabase.auth.getSession(); token = session?.access_token || ""; }
    if (!token) { setMessage(""); setAuthPurpose({ kind: "like", mediaId }); return; }
    setLikingIds(prev => new Set(prev).add(mediaId)); setNotice("");
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}/like`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json(); if (!res.ok) throw new Error(body.error || "Unable to update like.");
      setData(prev => prev ? { ...prev, media: prev.media.map(m => m.id === mediaId ? { ...m, liked_by_me: Boolean(body.liked), likes_count: Number(body.likes_count || 0) } : m) } : prev);
      setNotice(body.liked ? "Added to your likes." : "Like removed.");
    } catch (err) { setNotice(err instanceof Error ? err.message : "Unable to update like."); }
    finally { setLikingIds(prev => { const next = new Set(prev); next.delete(mediaId); return next; }); }
  }

  function openUnlock(mediaId?: string) { setMessage(""); setAuthPurpose({ kind: "unlock" }); track("UNLOCK_CLICK", mediaId); }
  async function shareProfile() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: data?.profile.display_name || "Creator profile", url });
      else { await navigator.clipboard.writeText(url); setNotice("Profile link copied."); }
    } catch { /* visitor cancelled share */ }
  }
  function openMedia(item: Media) {
    if (item.locked) { openUnlock(item.id); return; }
    setSelectedMedia(item); if (item.type === "PHOTO") track("PHOTO_VIEW", item.id);
  }

  const lockedCount = useMemo(() => data?.media.filter(m => m.visibility === "LOCKED").length || 0, [data]);
  const totalLikes = useMemo(() => data?.media.reduce((sum, item) => sum + Number(item.likes_count || 0), 0) || 0, [data]);
  const photoCount = useMemo(() => data?.media.filter(m => m.type === "PHOTO").length || 0, [data]);
  const videoCount = useMemo(() => data?.media.filter(m => m.type === "VIDEO").length || 0, [data]);
  const publicMedia = useMemo(() => data?.media.filter(m => m.visibility === "PUBLIC") || [], [data]);
  const exclusiveMedia = useMemo(() => data?.media.filter(m => m.visibility === "LOCKED") || [], [data]);
  const averageRating = useMemo(() => data?.reviews.length ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : 0, [data]);
  const visitorCity = visitorContext?.city || visitorContext?.region || visitorContext?.country || null;
  const showLocation = !visitorContext || Boolean(visitorCity);

  if (loading) return <div className="center-screen luxury-loader"><div className="loader-orb"/><span>Opening creator profile…</span></div>;
  if (!data) return <div className="center-screen"><div><h2>Creator not found</h2><Link className="btn primary" href="/">Back home</Link></div></div>;
  const modalIsLike = authPurpose?.kind === "like";

  return <main className="profile-page cinematic-profile">
    <header className="public-nav cinematic-nav"><Link href="/" className="brand">CreatorSpace<span>Demo</span></Link><div className="public-nav-actions"><button className="icon-btn" onClick={shareProfile} aria-label="Share profile"><Share2 size={17}/></button><Link href="/login" className="btn ghost small"><LogIn size={16}/> Login</Link></div></header>

    <div className="cinematic-shell">
      <section className="creator-hero">
        <div className="cinematic-cover" style={data.profile.cover_url ? { backgroundImage: `url(${data.profile.cover_url})` } : undefined}><div className="cover-vignette"/></div>
        <div className="hero-profile-layer">
          <div className="hero-avatar"><img src={data.profile.avatar_url || "/demo/avatar.svg"} alt={data.profile.display_name}/><span className="avatar-active"/></div>
          <div className="hero-copy-block"><div className="hero-name-row"><h1>{data.profile.display_name}</h1><span className="verified-luxury"><CheckCircle2 size={18}/></span></div><span className="hero-handle">@{data.profile.username}</span><p>{data.profile.bio || "Visual storyteller • city nights • travel journals • behind-the-scenes moments"}</p></div>
          <div className="hero-actions-right"><button className="btn glass-button" onClick={shareProfile}><Share2 size={16}/> Share</button><button className="icon-btn glass-button" aria-label="More profile options"><MoreHorizontal size={19}/></button></div>
        </div>
        <div className="hero-stat-bar">
          <span><Heart/><b>{totalLikes}</b><em>likes</em></span><span><Images/><b>{photoCount}</b><em>photos</em></span><span><Video/><b>{videoCount}</b><em>videos</em></span>
          {showLocation && <span className="location-luxury" title="Your approximate location"><MapPin/><b>{visitorCity || "Locating…"}</b>{visitorContext && <i className="live-dot"/>}</span>}
          <span><Star/><b>{averageRating ? averageRating.toFixed(1) : data.reviews.length}</b><em>{data.reviews.length} reviews</em></span>
        </div>
      </section>

      <nav className="luxury-tabs" aria-label="Creator profile sections">
        <button className={activeTab === "media" ? "active" : ""} onClick={() => setActiveTab("media")}>Media</button>
        <button className={activeTab === "reviews" ? "active" : ""} onClick={() => setActiveTab("reviews")}>Reviews</button>
        <button className={activeTab === "about" ? "active" : ""} onClick={() => setActiveTab("about")}>About</button>
      </nav>
      {notice && <div className="profile-notice luxury-notice">{notice}</div>}

      {activeTab === "media" && <>
        <section className="media-section"><div className="section-heading luxury-heading"><div><span className="eyebrow">Latest media</span><h2>Moments worth staying for.</h2></div><span>{publicMedia.length} public posts</span></div>
          {publicMedia.length === 0 ? <div className="empty-state">No public media has been published yet.</div> : <div className="cinematic-media-grid">{publicMedia.map((item, index) => <article className={`cinematic-media-card ${index % 5 === 0 ? "featured-card" : ""}`} key={item.id}>
            <button className="media-visual-button" onClick={() => openMedia(item)} aria-label={`Open ${item.title || "media"}`}>
              {item.type === "VIDEO" ? <><video src={item.media_url || ""} muted preload="metadata"/><span className="video-orb"><Play fill="currentColor"/></span></> : <img src={item.media_url || ""} alt={item.title || "Creator media"}/>}<span className="media-gradient"/>
            </button>
            <div className="media-card-info"><div><span className="media-kind">{item.type === "VIDEO" ? "Video" : "Photo"}</span><strong>{item.title || "Untitled moment"}</strong></div><button className={`floating-like ${item.liked_by_me ? "liked" : ""}`} disabled={likingIds.has(item.id)} onClick={() => toggleLike(item.id)}><Heart size={17} fill={item.liked_by_me ? "currentColor" : "none"}/><b>{Number(item.likes_count || 0)}</b></button></div>
          </article>)}</div>}
        </section>

        {lockedCount > 0 && <section className="exclusive-section"><div className="exclusive-backdrop"><div className="exclusive-glow one"/><div className="exclusive-glow two"/>
          <div className="exclusive-preview-grid">{exclusiveMedia.slice(0, 3).map((item, index) => <div className={`exclusive-preview preview-${index+1}`} key={item.id}>{!item.locked && item.media_url ? (item.type === "VIDEO" ? <video src={item.media_url} muted/> : <img src={item.media_url} alt=""/>) : <span/>}</div>)}</div>
          <div className="exclusive-content"><span className="exclusive-lock"><LockKeyhole/></span><div className="eyebrow">Exclusive collection</div><h2>{data.unlocked ? "Your private access is open." : "There’s more behind the curtain."}</h2><p>{data.unlocked ? "Explore the creator’s private photos and behind-the-scenes videos below." : `${lockedCount} private ${lockedCount === 1 ? "post" : "posts"} available for this creator. Unlock once to access the full collection.`}</p>{!data.unlocked ? <button className="btn primary premium-unlock" onClick={() => openUnlock()}><Unlock size={17}/> Unlock exclusive content</button> : <span className="pill success"><Unlock size={14}/> Unlocked</span>}</div>
        </div>
        {data.unlocked && <div className="cinematic-media-grid exclusive-unlocked-grid">{exclusiveMedia.map(item => <article className="cinematic-media-card" key={item.id}><button className="media-visual-button" onClick={() => openMedia(item)}>{item.type === "VIDEO" ? <><video src={item.media_url || ""} muted/><span className="video-orb"><Play fill="currentColor"/></span></> : <img src={item.media_url || ""} alt={item.title || "Exclusive media"}/>}<span className="media-gradient"/></button><div className="media-card-info"><div><span className="media-kind">Exclusive {item.type.toLowerCase()}</span><strong>{item.title || "Private moment"}</strong></div><button className={`floating-like ${item.liked_by_me ? "liked" : ""}`} onClick={() => toggleLike(item.id)}><Heart size={17} fill={item.liked_by_me ? "currentColor" : "none"}/><b>{Number(item.likes_count || 0)}</b></button></div></article>)}</div>}
        </section>}
      </>}

      {activeTab === "reviews" && <section className="reviews-section luxury-reviews"><div className="section-heading luxury-heading"><div><span className="eyebrow"><Star size={14}/> Community notes</span><h2>What people are saying.</h2></div><div className="rating-summary"><strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong><span>{data.reviews.length} reviews</span></div></div>{data.reviews.length === 0 ? <div className="empty-state">No reviews yet.</div> : <div className="review-grid luxury-review-grid">{data.reviews.map(r => <article className="review-card luxury-review" key={r.id}><div className="stars">{"★".repeat(r.rating)}<span>{"★".repeat(5-r.rating)}</span></div><p>“{r.review_text}”</p><div><strong>{r.reviewer_name}</strong>{r.is_featured && <span className="pill">Featured</span>}</div></article>)}</div>}</section>}

      {activeTab === "about" && <section className="about-luxury"><div className="about-story"><span className="eyebrow">About the creator</span><h2>{data.profile.display_name}</h2><p>{data.profile.bio || "A creator sharing public stories and an exclusive private collection."}</p></div><div className="about-facts"><div><span>Media library</span><strong>{photoCount + videoCount} posts</strong></div><div><span>Community love</span><strong>{totalLikes} likes</strong></div><div><span>Exclusive collection</span><strong>{lockedCount} posts</strong></div><div><span>Community rating</span><strong>{averageRating ? `${averageRating.toFixed(1)} / 5` : "New"}</strong></div></div></section>}
    </div>

    {selectedMedia && <div className="media-lightbox" onClick={() => setSelectedMedia(null)}><button className="modal-close lightbox-close" onClick={() => setSelectedMedia(null)}><X/></button><div className="lightbox-content" onClick={e => e.stopPropagation()}>{selectedMedia.type === "VIDEO" ? <video src={selectedMedia.media_url || ""} controls autoPlay onPlay={() => track("VIDEO_PLAY", selectedMedia.id)} onEnded={() => track("VIDEO_COMPLETE", selectedMedia.id)}/> : <img src={selectedMedia.media_url || ""} alt={selectedMedia.title || "Creator media"}/>}<div className="lightbox-caption"><strong>{selectedMedia.title || "Creator moment"}</strong><button className={`floating-like ${selectedMedia.liked_by_me ? "liked" : ""}`} onClick={() => toggleLike(selectedMedia.id)}><Heart size={18} fill={selectedMedia.liked_by_me ? "currentColor" : "none"}/><b>{Number(data.media.find(m => m.id === selectedMedia.id)?.likes_count || 0)}</b></button></div></div></div>}

    {authPurpose && <div className="modal-backdrop"><div className="modal-card luxury-modal"><button className="modal-close" onClick={() => { setAuthPurpose(null); setMessage(""); }}><X/></button><div className="lock-orb">{modalIsLike ? <Heart/> : <Unlock/>}</div><div className="eyebrow">{modalIsLike ? "Join the conversation" : "Private access"}</div><h2>{modalIsLike ? "Sign in to like" : `Unlock ${data.profile.display_name}`}</h2><p className="muted">{modalIsLike ? "Use an email and demo-site password. New emails automatically become Visitor accounts." : "Unlocking is creator-specific. This account will only receive access to this creator unless another creator is unlocked separately."}</p><form className="form-stack" onSubmit={submitAuth}><label>Email<input name="email" type="email" required placeholder="visitor@example.com" /></label><label>Demo-site password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters" /></label>{message && <div className="alert error">{message}</div>}<button className="btn primary wide" disabled={authBusy}>{authBusy ? "Please wait…" : (modalIsLike ? "Continue & like" : "Unlock content")}</button></form><p className="tiny muted">This demo never asks for a Gmail, Facebook or other external account password.</p></div></div>}
  </main>;
}
