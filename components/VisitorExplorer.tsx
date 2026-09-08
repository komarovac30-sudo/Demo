"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ChevronRight, Eye, Heart, MapPin, MonitorSmartphone, RefreshCw, Search, Unlock, Users } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Visitor = {
  key: string;
  ip_address: string;
  city: string | null;
  country: string | null;
  device_type: string;
  browser: string;
  os: string;
  first_seen: string;
  last_seen: string;
  events: number;
  visits: number;
  media_views: number;
  likes: number;
  unlocks: number;
  active_now: boolean;
  creators: string[];
};

type Payload = {
  totals: { unique_visitors: number; profile_views: number; media_views: number; unlocks: number; likes: number; active_today: number };
  visitors: Visitor[];
};

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString();
}

export default function VisitorExplorer({ mode }: { mode: "creator" | "admin" }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "unlocked" | "liked">("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setError("Sign in required."); setLoading(false); return; }
    const res = await fetch("/api/analytics/visitors", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const body = await res.json();
    if (!res.ok) { setError(body.error || "Unable to load visitors."); setLoading(false); return; }
    setData(body as Payload); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visitors = useMemo(() => {
    const value = query.trim().toLowerCase();
    return (data?.visitors || []).filter(visitor => {
      if (filter === "active" && !visitor.active_now) return false;
      if (filter === "unlocked" && visitor.unlocks <= 0) return false;
      if (filter === "liked" && visitor.likes <= 0) return false;
      if (!value) return true;
      return [visitor.ip_address, visitor.city, visitor.country, visitor.device_type, visitor.browser, visitor.os, ...visitor.creators]
        .filter(Boolean).join(" ").toLowerCase().includes(value);
    });
  }, [data, query, filter]);

  const backHref = mode === "admin" ? "/admin" : "/dashboard";
  const basePath = mode === "admin" ? "/admin/visitors" : "/dashboard/visitors";

  return (
    <main className="dashboard-page intelligence-page">
      <aside className="sidebar luxury-sidebar">
        <Link href="/" className="brand">CreatorSpace<span>Demo</span></Link>
        <div className="sidebar-role">{mode === "admin" ? "Super Admin" : "Creator Studio"}</div>
        <nav>
          <Link href={backHref}>Overview</Link>
          {mode === "admin" ? <Link href="/admin#creators">Creators</Link> : <Link href="/dashboard#content">Media</Link>}
          <Link className="active" href={basePath}>Visitors</Link>
          <Link href={`${backHref}#analytics`}>Analytics</Link>
          <Link href={`${backHref}#reviews`}>Reviews</Link>
        </nav>
        <div className="sidebar-foot-note"><span className="live-dot"/> Visitor intelligence is live</div>
      </aside>

      <section className="dashboard-main intelligence-main">
        <div className="dashboard-header intelligence-header">
          <div><div className="eyebrow"><Activity size={15}/> Visitor intelligence</div><h1>Know your audience.</h1><p className="header-subtitle">Each unique captured IP appears once. Open any visitor to see their complete journey.</p></div>
          <button className="btn ghost" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""}/> Refresh</button>
        </div>

        {error && <div className="alert error">{error}</div>}
        <div className="intelligence-kpis">
          <div className="metric-card"><Users/><span>Unique visitors</span><strong>{data?.totals.unique_visitors ?? "—"}</strong><small>{data?.totals.active_today ?? 0} active in 24h</small></div>
          <div className="metric-card"><Eye/><span>Profile views</span><strong>{data?.totals.profile_views ?? "—"}</strong><small>All tracked visits</small></div>
          <div className="metric-card"><Activity/><span>Media views</span><strong>{data?.totals.media_views ?? "—"}</strong><small>Photos + video activity</small></div>
          <div className="metric-card"><Heart/><span>Net likes</span><strong>{data?.totals.likes ?? "—"}</strong><small>Current engagement signal</small></div>
          <div className="metric-card"><Unlock/><span>Unlocks</span><strong>{data?.totals.unlocks ?? "—"}</strong><small>Successful access</small></div>
        </div>

        <section className="panel visitor-panel">
          <div className="visitor-toolbar">
            <div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search IP, city, device or creator…"/></div>
            <div className="filter-pills">
              {([['all','All visitors'],['active','Active now'],['unlocked','Unlocked'],['liked','Liked content']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={filter === value ? "active" : ""}>{label}</button>)}
            </div>
          </div>

          {loading ? <div className="visitor-loading"><span className="skeleton-line"/><span className="skeleton-line"/><span className="skeleton-line"/></div> : visitors.length === 0 ? <div className="empty-state">No visitors match this view yet.</div> : <div className="unique-visitor-list">
            {visitors.map(visitor => <Link className="unique-visitor-card" href={`${basePath}/${visitor.key}`} key={visitor.key}>
              <div className="visitor-identity">
                <span className={`visitor-status ${visitor.active_now ? "online" : ""}`}/>
                <div><strong className="ip-text">{visitor.ip_address}</strong><span><MapPin size={13}/>{visitor.city || "Location unavailable"}{visitor.country ? `, ${visitor.country}` : ""}</span></div>
              </div>
              {mode === "admin" && <div className="visitor-creator"><small>Creator</small><strong>{visitor.creators.join(", ") || "—"}</strong></div>}
              <div className="visitor-device"><MonitorSmartphone size={15}/><div><strong>{visitor.device_type}</strong><span>{visitor.browser} • {visitor.os}</span></div></div>
              <div className="visitor-engagement"><span><b>{visitor.visits}</b> visits</span><span><b>{visitor.media_views}</b> media</span><span><b>{Math.max(visitor.likes, 0)}</b> likes</span><span><b>{visitor.unlocks}</b> unlocks</span></div>
              <div className="visitor-last"><small>Last seen</small><strong>{relativeTime(visitor.last_seen)}</strong><span>First {new Date(visitor.first_seen).toLocaleDateString()}</span></div>
              <ChevronRight className="visitor-arrow" size={20}/>
            </Link>)}
          </div>}
        </section>
      </section>
    </main>
  );
}
