"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck, ChevronRight, Heart, Images, LockKeyhole, Mail, MapPin, MessageSquareText,
  Phone, Play, Share2, ShieldCheck, Sparkles, Star, Unlock, Video, X
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";

type Media = {
  id: string; type: "PHOTO" | "VIDEO"; visibility: "PUBLIC" | "LOCKED"; title: string | null;
  description?: string | null; media_url: string | null; thumbnail_url?: string | null; locked: boolean;
  likes_count?: number; liked_by_me?: boolean;
};
type Review = {
  id: string; reviewer_name: string; reviewer_first_name?: string | null; reviewer_last_name?: string | null;
  reviewer_avatar_url?: string | null; rating: number; review_text: string; is_featured: boolean; created_at?: string; source?: string;
};
type Profile = {
  id: string; username: string; display_name: string; bio: string | null; headline: string | null;
  avatar_url: string | null; cover_url: string | null; is_verified: boolean; public_phone: string | null; public_email: string | null;
  exclusive_price: number; exclusive_currency: string; profile_likes_count?: number;
};
type Payload = { profile: Profile; media: Media[]; reviews: Review[]; unlocked: boolean };
type VisitorContext = { city: string | null; country: string | null; region: string | null };
type Tab = "media" | "reviews" | "about";
type GateIntent = "review" | "unlock";

function currency(amount: number, code: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code || "USD" }).format(amount); }
  catch { return `$${amount.toFixed(2)}`; }
}
function reviewerDisplay(review: Review) {
  const first = review.reviewer_first_name?.trim();
  const last = review.reviewer_last_name?.trim();
  if (first && last) return `${first} ${last.length === 1 || last.endsWith(".") ? last : `${last[0]}.`}`;
  return review.reviewer_name;
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitorContext, setVisitorContext] = useState<VisitorContext | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("media");
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [notice, setNotice] = useState("");
  const [liking, setLiking] = useState<Set<string>>(new Set());

  const [gateIntent, setGateIntent] = useState<GateIntent | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "create">("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/public/profile/${encodeURIComponent(username)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) { setData(null); setLoading(false); return; }
    setData(await res.json() as Payload);
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data?.profile.id) return;
    track("PROFILE_VIEW").then(context => setVisitorContext(context || { city: null, country: null, region: null }));
    if (data.media.some(m => m.visibility === "LOCKED" && m.locked)) track("LOCKED_CONTENT_SEEN");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.profile.id]);

  async function track(eventType: string, mediaId?: string): Promise<VisitorContext | null> {
    if (!data?.profile.id) return null;
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ profile_id: data.profile.id, media_id: mediaId || null, event_type: eventType }),
      });
      if (!res.ok) return null;
      const body = await res.json();
      return body.context || null;
    } catch { return null; }
  }

  async function shareProfile() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: data?.profile.display_name || "Profile", url });
      else { await navigator.clipboard.writeText(url); setNotice("Profile link copied."); }
    } catch { /* share cancelled */ }
  }

  async function startGate(intent: GateIntent, mediaId?: string) {
    setAuthError("");
    if (intent === "review") await track("REVIEW_STARTED"); else await track("UNLOCK_CLICK", mediaId);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      if (intent === "review") setReviewOpen(true); else setCheckoutOpen(true);
      return;
    }
    await track("AUTH_STARTED");
    setAuthMode("signin");
    setGateIntent(intent);
  }

  async function submitAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!gateIntent) return;
    setAuthBusy(true); setAuthError("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const displayName = String(form.get("display_name") || "Visitor").trim();
    try {
      if (authMode === "create") {
        const reg = await fetch("/api/auth/demo-register", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, display_name: displayName }),
        });
        const body = await reg.json();
        if (!reg.ok) throw new Error(body.error || "Unable to create account.");
      }
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.session) throw new Error(result.error?.message || "Unable to sign in.");
      const intended = gateIntent;
      setGateIntent(null);
      await track("AUTH_SUCCESS");
      if (intended === "review") setReviewOpen(true); else setCheckoutOpen(true);
      await load();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Unable to continue.");
      await track("AUTH_FAILED");
    } finally { setAuthBusy(false); }
  }

  async function submitReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setReviewBusy(true); setReviewError("");
    const form = new FormData(e.currentTarget);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Please try again.");
      let avatarUrl: string | null = null;
      const avatar = form.get("reviewer_avatar") as File;
      if (avatar?.size) avatarUrl = (await uploadToCloudinary(avatar, session.access_token, "review-avatar")).secure_url;
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          creator_id: data.profile.id,
          reviewer_first_name: form.get("reviewer_first_name"),
          reviewer_last_name: form.get("reviewer_last_name"),
          rating: Number(form.get("rating")),
          review_text: form.get("review_text"),
          reviewer_avatar_url: avatarUrl,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to submit review.");
      setReviewOpen(false);
      setNotice("Review submitted. It will appear after admin approval.");
    } catch (err) { setReviewError(err instanceof Error ? err.message : "Unable to submit review."); }
    finally { setReviewBusy(false); }
  }

  async function completeDemoCheckout() {
    if (!data) return;
    setCheckoutBusy(true); setNotice("");
    await track("PAYMENT_STARTED");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Please try again.");
      const res = await fetch("/api/exclusive/demo-unlock", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ creator_id: data.profile.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to complete demo checkout.");
      setCheckoutOpen(false);
      setNotice("Private gallery unlocked for this demo account.");
      await load();
    } catch (err) {
      await track("PAYMENT_FAILED");
      setNotice(err instanceof Error ? err.message : "Unable to unlock content.");
    }
    finally { setCheckoutBusy(false); }
  }

  async function toggleLike(item: Media) {
    if (item.locked) { await startGate("unlock", item.id); return; }
    setLiking(prev => new Set(prev).add(item.id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/media/${encodeURIComponent(item.id)}/like`, {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to update like.");
      setData(prev => prev ? { ...prev, media: prev.media.map(m => m.id === item.id ? { ...m, liked_by_me: Boolean(body.liked), likes_count: Number(body.likes_count || 0) } : m) } : prev);
    } catch (err) { setNotice(err instanceof Error ? err.message : "Unable to update like."); }
    finally { setLiking(prev => { const next = new Set(prev); next.delete(item.id); return next; }); }
  }

  function openMedia(item: Media) {
    if (item.locked) { startGate("unlock", item.id); return; }
    setSelectedMedia(item);
    track(item.type === "VIDEO" ? "VIDEO_PLAY" : "PHOTO_VIEW", item.id);
  }

  const publicMedia = useMemo(() => data?.media.filter(m => m.visibility === "PUBLIC") || [], [data]);
  const exclusiveMedia = useMemo(() => data?.media.filter(m => m.visibility === "LOCKED") || [], [data]);
  const totalLikes = useMemo(() => Number(data?.profile.profile_likes_count ?? data?.media.reduce((sum, m) => sum + Number(m.likes_count || 0), 0) ?? 0), [data]);
  const photoCount = useMemo(() => data?.media.filter(m => m.type === "PHOTO").length || 0, [data]);
  const videoCount = useMemo(() => data?.media.filter(m => m.type === "VIDEO").length || 0, [data]);
  const averageRating = useMemo(() => data?.reviews.length ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : 0, [data]);

  if (loading) return <div className="center-screen public-loading"><span className="loader-orb"/><p>Opening profile…</p></div>;
  if (!data) return <div className="center-screen"><div className="friendly-error"><h2>Profile unavailable</h2><p>This profile may be inactive or the link may be incorrect.</p><Link href="/" className="btn primary">Back home</Link></div></div>;
  const p = data.profile;

  return <main className="public-profile-page">
    <header className="public-topbar">
      <Link href="/" className="veloura-brand"><span>V</span>VELOURA</Link>
      <div className="public-top-actions"><span className="adult-demo-badge">18+ DEMO</span><button className="round-icon" onClick={shareProfile} aria-label="Share profile"><Share2 size={18}/></button></div>
    </header>

    <div className="public-profile-shell">
      <section className="profile-hero-v5">
        <div className="profile-cover-v5" style={p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined}><div className="cover-shade"/></div>
        <div className="profile-identity-v5">
          <div className="profile-avatar-v5"><img src={p.avatar_url || "/demo/avatar-v5.svg"} alt={p.display_name}/><span className="online-ring"/></div>
          <div className="profile-main-copy">
            <div className="profile-name-row"><h1>{p.display_name}</h1>{p.is_verified && <span className="verified-badge" title="Demo verified profile"><BadgeCheck size={21}/></span>}</div>
            <span className="profile-handle">@{p.username}</span>
            <p className="profile-headline">{p.headline || "Independent profile • Private media journal"}</p>
            <span className="profile-location auto-location-v6"><MapPin size={14}/>{visitorContext?.city ? `${visitorContext.city}${visitorContext.country ? `, ${visitorContext.country}` : ""}` : visitorContext ? "Location unavailable" : "Detecting your area…"}<i className="mini-live-dot"/></span>
          </div>
          <div className="profile-contact-actions">
            {p.public_phone && <a className="contact-action call" href={`tel:${p.public_phone.replace(/[^+\d]/g, "")}`} onClick={() => track("CONTACT_PHONE_CLICK")}><Phone size={17}/><span>Call</span></a>}
            {p.public_email && <a className="contact-action" href={`mailto:${p.public_email}`} onClick={() => track("CONTACT_EMAIL_CLICK")}><Mail size={17}/><span>Email</span></a>}
            <button className="contact-action" onClick={shareProfile}><Share2 size={17}/><span>Share</span></button>
          </div>
        </div>
        <div className="public-stat-strip">
          <span><Heart size={16}/><b>{totalLikes}</b><em>likes</em></span>
          <span><Images size={16}/><b>{photoCount}</b><em>photos</em></span>
          <span><Video size={16}/><b>{videoCount}</b><em>videos</em></span>
          {visitorContext?.city && <span className="visitor-location-stat" title="Your approximate location based on network/IP"><MapPin size={16}/><b>{visitorContext.city}</b><em>your location •</em><i className="mini-live-dot"/></span>}
          <span><Star size={16}/><b>{averageRating ? averageRating.toFixed(1) : "New"}</b><em>{data.reviews.length} reviews</em></span>
          <span className="trust-stat"><ShieldCheck size={16}/><b>Private</b><em>direct profile</em></span>
        </div>
      </section>

      {notice && <div className="profile-toast" onClick={() => setNotice("")}>{notice}<X size={14}/></div>}

      <nav className="profile-tabs-v5">
        {(["media", "reviews", "about"] as Tab[]).map(tab => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab === "media" ? "Media" : tab === "reviews" ? `Reviews ${data.reviews.length}` : "About"}</button>)}
      </nav>

      {activeTab === "media" && <section className="profile-section-v5">
        <div className="section-title-row"><div><span className="section-kicker">PUBLIC JOURNAL</span><h2>Latest moments</h2><p>Photos and short previews shared publicly.</p></div></div>
        {publicMedia.length ? <div className="public-media-grid-v5">{publicMedia.map((item, index) => <article key={item.id} className={`media-tile-v5 ${index === 0 ? "hero-tile" : ""}`} onClick={() => openMedia(item)}>
          {item.type === "VIDEO" ? <div className="video-tile"><video src={item.media_url || undefined} poster={item.thumbnail_url || undefined} muted playsInline/><span className="play-float"><Play size={22} fill="currentColor"/></span></div> : <img src={item.media_url || "/demo/media-01.svg"} alt={item.title || "Public media"}/>} 
          <div className="media-tile-overlay"><div><span>{item.type === "VIDEO" ? "VIDEO" : "PHOTO"}</span><strong>{item.title || "Untitled"}</strong></div><button className={`tile-like ${item.liked_by_me ? "liked" : ""}`} disabled={liking.has(item.id)} onClick={e => { e.stopPropagation(); toggleLike(item); }}><Heart size={16} fill={item.liked_by_me ? "currentColor" : "none"}/>{Number(item.likes_count || 0)}</button></div>
        </article>)}</div> : <div className="empty-card-v5">No public media yet.</div>}

        <section className={`exclusive-showcase-v5 ${data.unlocked ? "unlocked" : ""}`}>
          <div className="exclusive-copy-v5"><span className="section-kicker"><LockKeyhole size={13}/> PRIVATE COLLECTION</span><h2>{data.unlocked ? "Your private gallery is open" : "Unlock the private collection"}</h2><p>{data.unlocked ? "This account has access to the full private photo and video collection." : "One demo purchase unlocks this profile’s current private library. No real charge is made in this client-preview build."}</p>
            {!data.unlocked && <button className="btn premium-cta" onClick={() => startGate("unlock")}><Unlock size={18}/> Unlock for {currency(p.exclusive_price, p.exclusive_currency)}</button>}
            {data.unlocked && <span className="unlocked-label"><ShieldCheck size={16}/> Access active</span>}
          </div>
          <div className="exclusive-grid-v5">{exclusiveMedia.slice(0, 4).map((item, index) => <article key={item.id} className={`exclusive-tile ${item.locked ? "locked" : ""}`} onClick={() => openMedia(item)}>
            {item.locked ? <img src={`/demo/locked-v5-0${Math.min(index + 1, 4)}.svg`} alt="Locked preview"/> : item.type === "VIDEO" ? <video src={item.media_url || undefined} muted playsInline/> : <img src={item.media_url || "/demo/locked-v5-01.svg"} alt={item.title || "Private media"}/>} 
            {item.locked && <div className="locked-mask"><LockKeyhole size={22}/><span>Private</span></div>}
            {!item.locked && <div className="media-tile-overlay"><strong>{item.title}</strong><button className={`tile-like ${item.liked_by_me ? "liked" : ""}`} onClick={e => { e.stopPropagation(); toggleLike(item); }}><Heart size={15} fill={item.liked_by_me ? "currentColor" : "none"}/>{item.likes_count || 0}</button></div>}
          </article>)}</div>
        </section>
      </section>}

      {activeTab === "reviews" && <section className="profile-section-v5 reviews-section-v5">
        <div className="review-summary-v5"><div className="review-score"><strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong><div><span className="stars-line">{"★".repeat(Math.round(averageRating || 0))}{"☆".repeat(5 - Math.round(averageRating || 0))}</span><p>{data.reviews.length} published reviews</p></div></div><button className="btn secondary" onClick={() => startGate("review")}><MessageSquareText size={17}/> Write a review</button></div>
        <div className="trust-note-v5"><ShieldCheck size={18}/><div><strong>Reviews are moderated before publication.</strong><span>Visitors can read reviews without an account. Sign-in appears only when a visitor chooses to submit one.</span></div></div>
        {data.reviews.length ? <div className="review-grid-v5">{data.reviews.map(review => <article key={review.id} className={`review-card-v5 ${review.is_featured ? "featured" : ""}`}>
          <div className="review-head-v5"><img src={review.reviewer_avatar_url || "/demo/reviewers/default-reviewer.svg"} alt=""/><div><strong>{reviewerDisplay(review)}</strong><span>{review.source === "VISITOR" ? "Visitor review" : "Verified demo review"}</span></div><span className="review-stars">{"★".repeat(review.rating)}</span></div>
          <p>“{review.review_text}”</p>{review.is_featured && <span className="featured-review-label"><Sparkles size={12}/> Featured review</span>}
        </article>)}</div> : <div className="empty-card-v5">No published reviews yet.</div>}
      </section>}

      {activeTab === "about" && <section className="profile-section-v5 about-section-v5">
        <div className="about-story-v5"><span className="section-kicker">ABOUT</span><h2>A little about {p.display_name.split(" ")[0]}</h2><p>{p.bio || "This profile owner has not added an About section yet."}</p></div>
        <div className="about-side-v5">
          <article><MapPin/><div><span>Your approximate location</span><strong>{visitorContext?.city ? `${visitorContext.city}${visitorContext.country ? `, ${visitorContext.country}` : ""}` : visitorContext ? "Location unavailable" : "Detecting from your network…"}</strong></div></article>
          <article><BadgeCheck/><div><span>Profile status</span><strong>{p.is_verified ? "Verified demo profile" : "Active profile"}</strong></div></article>
          <article><LockKeyhole/><div><span>Private media</span><strong>{exclusiveMedia.length} exclusive items</strong></div></article>
          {(p.public_phone || p.public_email) && <article><Phone/><div><span>Direct contact</span><strong>{p.public_phone || p.public_email}</strong></div></article>}
        </div>
      </section>}

      <footer className="public-profile-footer"><div className="veloura-brand small"><span>V</span>VELOURA</div><p>Client-preview environment. Demo identity, contact details, reviews, media and checkout are fictional.</p></footer>
    </div>

    {gateIntent && <div className="modal-backdrop" onMouseDown={() => setGateIntent(null)}><section className="gate-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setGateIntent(null)}><X/></button><div className="modal-icon"><ShieldCheck/></div><span className="section-kicker">{gateIntent === "review" ? "REVIEW IDENTITY" : "PRIVATE ACCESS"}</span><h2>{gateIntent === "review" ? "Sign in before reviewing" : "Sign in to continue"}</h2><p>Your account is requested only for this gated action. Normal profile browsing stays open.</p>
      <div className="auth-switch"><button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Sign in</button><button className={authMode === "create" ? "active" : ""} onClick={() => setAuthMode("create")}>Create account</button></div>
      <form className="modal-form" onSubmit={submitAuth}>{authMode === "create" && <label>Display name<input name="display_name" required placeholder="Your name"/></label>}<label>Email<input name="email" type="email" required placeholder="you@example.com"/></label><label>Password<input name="password" type="password" minLength={8} required placeholder="8+ characters"/></label>{authError && <div className="alert error">{authError}</div>}<button className="btn premium-cta wide" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signin" ? "Sign in & continue" : "Create account & continue"}</button></form>
    </section></div>}

    {reviewOpen && <div className="modal-backdrop" onMouseDown={() => setReviewOpen(false)}><section className="gate-modal review-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setReviewOpen(false)}><X/></button><span className="section-kicker">SHARE YOUR EXPERIENCE</span><h2>Write a review</h2><p>Your review will be submitted to Admin for moderation before it appears publicly.</p><form className="modal-form" onSubmit={submitReview}><div className="two-fields"><label>First name<input name="reviewer_first_name" required maxLength={60}/></label><label>Last name<input name="reviewer_last_name" required maxLength={60}/></label></div><label>Profile image <small>Optional</small><input name="reviewer_avatar" type="file" accept="image/*"/></label><label>Rating<select name="rating" defaultValue="5">{[5,4,3,2,1].map(n => <option value={n} key={n}>{"★".repeat(n)} {n} star{n > 1 ? "s" : ""}</option>)}</select></label><label>Review<textarea name="review_text" required minLength={10} maxLength={1200} rows={5} placeholder="Write a clear, respectful review…"/></label>{reviewError && <div className="alert error">{reviewError}</div>}<button className="btn premium-cta wide" disabled={reviewBusy}>{reviewBusy ? "Submitting…" : "Submit for review"}</button></form></section></div>}

    {checkoutOpen && <div className="modal-backdrop" onMouseDown={() => setCheckoutOpen(false)}><section className="gate-modal checkout-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setCheckoutOpen(false)}><X/></button><div className="modal-icon"><Unlock/></div><span className="section-kicker">DEMO CHECKOUT</span><h2>Unlock private media</h2><div className="checkout-price"><strong>{currency(p.exclusive_price, p.exclusive_currency)}</strong><span>one-time demo unlock</span></div><div className="checkout-benefits"><span><BadgeCheck/> Full private gallery for @{p.username}</span><span><BadgeCheck/> Photos + videos currently marked private</span><span><BadgeCheck/> Creator-specific access only</span></div><div className="demo-warning"><ShieldCheck/><div><strong>No real payment is processed.</strong><span>This button simulates a confirmed digital-content purchase for the client demo. Connect an approved provider before production.</span></div></div><button className="btn premium-cta wide" disabled={checkoutBusy} onClick={completeDemoCheckout}>{checkoutBusy ? "Unlocking…" : `Complete demo purchase • ${currency(p.exclusive_price, p.exclusive_currency)}`}</button></section></div>}

    {selectedMedia && <div className="media-lightbox" onClick={() => setSelectedMedia(null)}><button className="modal-close lightbox-close"><X/></button><div className="lightbox-content" onClick={e => e.stopPropagation()}>{selectedMedia.type === "VIDEO" ? <video src={selectedMedia.media_url || undefined} controls autoPlay onEnded={() => track("VIDEO_COMPLETE", selectedMedia.id)}/> : <img src={selectedMedia.media_url || ""} alt={selectedMedia.title || "Media"}/>}<div className="lightbox-caption"><div><span>{selectedMedia.type}</span><strong>{selectedMedia.title}</strong><p>{selectedMedia.description}</p></div><button className={`tile-like big ${selectedMedia.liked_by_me ? "liked" : ""}`} onClick={() => toggleLike(selectedMedia)}><Heart size={18} fill={selectedMedia.liked_by_me ? "currentColor" : "none"}/>{selectedMedia.likes_count || 0}</button></div></div></div>}
  </main>;
}
