"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, CalendarDays, Clock3, Eye, Heart, Images, LockKeyhole, MapPin, MonitorSmartphone, RefreshCw, Unlock, Video } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Detail = {
  summary: {
    key: string; ip_address: string; city: string|null; country: string|null; device_type: string; browser: string; os: string;
    first_seen: string; last_seen: string; events: number; visits: number; media_views: number; likes: number; unlocks: number; locked_seen: number; active_now: boolean; creators: string[];
  };
  sessions: { id: string; started_at: string; ended_at: string; actions: number; device_type: string; browser: string; os: string }[];
  timeline: { id: string; event_type: string; created_at: string; media_title: string|null; creator_name: string }[];
  media_interest: { media_id: string; title: string; views: number; likes: number }[];
};

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    PROFILE_VIEW: "Viewed creator profile", PHOTO_VIEW: "Viewed a photo", VIDEO_PLAY: "Played a video", VIDEO_COMPLETE: "Completed a video",
    LOCKED_CONTENT_SEEN: "Saw exclusive content", UNLOCK_CLICK: "Clicked unlock", UNLOCK_SUCCESS: "Unlocked creator content", UNLOCK_FAILED: "Unlock failed",
    MEDIA_LIKE: "Liked media", MEDIA_UNLIKE: "Removed a like", LOGIN_STARTED: "Started login", LOGIN_SUCCESS: "Signed in", LOGIN_FAILED: "Login failed",
  };
  return labels[type] || type.replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase());
}

function eventIcon(type: string) {
  if (type.includes("LIKE")) return <Heart size={16}/>;
  if (type.includes("UNLOCK")) return <Unlock size={16}/>;
  if (type.includes("VIDEO")) return <Video size={16}/>;
  if (type.includes("PHOTO") || type.includes("MEDIA")) return <Images size={16}/>;
  if (type.includes("LOCKED")) return <LockKeyhole size={16}/>;
  return <Eye size={16}/>;
}

export default function VisitorDetail({ visitorKey, mode }: { visitorKey: string; mode: "creator" | "admin" }) {
  const [data, setData] = useState<Detail|null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setError("Sign in required."); setLoading(false); return; }
    const res = await fetch(`/api/analytics/visitors/${encodeURIComponent(visitorKey)}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const body = await res.json(); if (!res.ok) { setError(body.error || "Unable to load visitor."); setLoading(false); return; }
    setData(body as Detail); setLoading(false);
  }, [visitorKey]);
  useEffect(() => { load(); }, [load]);

  const basePath = mode === "admin" ? "/admin/visitors" : "/dashboard/visitors";
  const maxInterest = useMemo(() => Math.max(1, ...(data?.media_interest || []).map(item => item.views + item.likes)), [data]);

  if (loading) return <div className="center-screen">Loading visitor journey…</div>;
  if (error || !data) return <div className="center-screen"><div><h2>Visitor details unavailable</h2><p className="muted">{error}</p><Link className="btn primary" href={basePath}>Back to visitors</Link></div></div>;
  const v = data.summary;

  return <main className="visitor-detail-page">
    <div className="detail-shell">
      <div className="detail-topbar"><Link className="back-link compact" href={basePath}><ArrowLeft size={17}/> Visitors</Link><button className="btn ghost small" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
      <section className="visitor-hero-card">
        <div className="visitor-hero-main"><span className={`hero-status ${v.active_now ? "online" : ""}`}/><div><div className="eyebrow">Visitor journey</div><h1>{v.ip_address}</h1><p><MapPin size={15}/>{v.city || "Location unavailable"}{v.country ? `, ${v.country}` : ""}</p></div></div>
        <div className="visitor-hero-device"><MonitorSmartphone/><div><small>Current signature</small><strong>{v.device_type}</strong><span>{v.browser} • {v.os}</span></div></div>
        {mode === "admin" && <div className="visitor-hero-creators"><small>Creator activity</small><strong>{v.creators.join(", ") || "—"}</strong></div>}
        <div className="visitor-seen"><span><CalendarDays size={15}/> First seen <b>{new Date(v.first_seen).toLocaleString()}</b></span><span><Clock3 size={15}/> Last seen <b>{new Date(v.last_seen).toLocaleString()}</b></span></div>
      </section>

      <div className="detail-kpis">
        <div><Eye/><strong>{v.visits}</strong><span>Profile visits</span></div><div><Activity/><strong>{v.events}</strong><span>Total actions</span></div><div><Images/><strong>{v.media_views}</strong><span>Media views</span></div><div><Heart/><strong>{Math.max(v.likes,0)}</strong><span>Net likes</span></div><div><Unlock/><strong>{v.unlocks}</strong><span>Unlocks</span></div>
      </div>

      <div className="detail-grid">
        <section className="panel journey-panel"><div className="panel-title"><div><h2>Activity journey</h2><p>The visitor’s interactions in chronological context.</p></div><Activity/></div>
          <div className="journey-timeline">{data.timeline.map(item => <article className="journey-event" key={item.id}><span className="journey-icon">{eventIcon(item.event_type)}</span><div><strong>{eventLabel(item.event_type)}</strong>{item.media_title && <span>{item.media_title}</span>}{mode === "admin" && <small>{item.creator_name}</small>}</div><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div>
        </section>
        <aside>
          <section className="panel"><div className="panel-title"><div><h2>Session history</h2><p>30-minute inactivity separates sessions.</p></div><Clock3/></div><div className="session-list">{data.sessions.map(session => <div className="session-card" key={session.id}><div><strong>{new Date(session.started_at).toLocaleDateString()}</strong><span>{new Date(session.started_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} – {new Date(session.ended_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div><b>{session.actions} actions</b><small>{session.device_type} • {session.browser}</small></div>)}</div></section>
          <section className="panel"><div className="panel-title"><div><h2>Content interest</h2><p>Most engaged media from this visitor.</p></div><Heart/></div>{data.media_interest.length === 0 ? <div className="empty-state compact-empty">No media engagement yet.</div> : <div className="interest-list">{data.media_interest.map(item => <div className="interest-row" key={item.media_id}><div><strong>{item.title}</strong><span>{item.views} views • {item.likes} likes</span></div><div className="interest-track"><i style={{width:`${Math.max(8,((item.views+item.likes)/maxInterest)*100)}%`}}/></div></div>)}</div>}</section>
        </aside>
      </div>
    </div>
  </main>;
}
