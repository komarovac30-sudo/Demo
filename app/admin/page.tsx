"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, LogOut, Plus, ShieldCheck, Star, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Creator = { id: string; display_name: string; username: string; bio: string | null; is_active: boolean };
type EventRow = { id: string; event_type: string; created_at: string; profile_id: string };

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setReady(true); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "SUPER_ADMIN") { setReady(true); return; }
    setAuthorized(true);
    const [{ data: creatorRows }, { data: eventRows }] = await Promise.all([
      supabase.from("profiles").select("id,display_name,username,bio,is_active").eq("role", "CREATOR").order("created_at", { ascending: false }),
      supabase.from("activity_events").select("id,event_type,created_at,profile_id").order("created_at", { ascending: false }).limit(20),
    ]);
    setCreators((creatorRows || []) as Creator[]);
    setEvents((eventRows || []) as EventRow[]);
    setReady(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createCreator(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage("");
    const form = new FormData(e.currentTarget);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/create-creator", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const body = await res.json();
    setMessage(res.ok ? "Creator account created." : (body.error || "Unable to create creator."));
    if (res.ok) { e.currentTarget.reset(); await load(); }
  }

  async function addReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage("");
    const form = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reviews").insert({
      creator_id: form.get("creator_id"), reviewer_name: form.get("reviewer_name"),
      rating: Number(form.get("rating")), review_text: form.get("review_text"), created_by: user?.id,
      is_published: true,
    });
    setMessage(error ? error.message : "Review added successfully.");
    if (!error) e.currentTarget.reset();
  }

  async function logout() { await supabase.auth.signOut(); location.href = "/login"; }

  if (!ready) return <div className="center-screen">Loading admin dashboard…</div>;
  if (!authorized) return <div className="center-screen"><div><h2>Admin access required</h2><Link className="btn primary" href="/login">Go to login</Link></div></div>;

  return (
    <main className="dashboard-page">
      <aside className="sidebar">
        <Link href="/" className="brand">CreatorSpace<span>Demo</span></Link>
        <nav><a href="#overview">Overview</a><a href="#creators">Creators</a><a href="#reviews">Reviews</a><a href="#activity">Activity</a></nav>
        <button className="btn ghost wide" onClick={logout}><LogOut size={17}/> Log out</button>
      </aside>
      <section className="dashboard-main">
        <div className="dashboard-header"><div><div className="eyebrow"><ShieldCheck size={15}/> Super Admin</div><h1>Platform overview</h1></div><Link className="btn secondary" href="/u/creator">Public profile</Link></div>
        {message && <div className="alert success">{message}</div>}
        <div id="overview" className="kpi-grid">
          <div className="kpi"><Users/><strong>{creators.length}</strong><span>Creators</span></div>
          <div className="kpi"><Activity/><strong>{events.length}</strong><span>Recent events</span></div>
          <div className="kpi"><Star/><strong>5</strong><span>Review system</span></div>
        </div>

        <div className="dashboard-grid">
          <section id="creators" className="panel">
            <div className="panel-title"><div><h2>Creator accounts</h2><p>Create User B accounts from the dashboard.</p></div><UserPlus/></div>
            <form className="compact-form" onSubmit={createCreator}>
              <input name="display_name" placeholder="Display name" required />
              <input name="username" placeholder="username" required />
              <input name="email" type="email" placeholder="creator@email.com" required />
              <input name="password" type="password" placeholder="Temporary password" minLength={8} required />
              <button className="btn primary"><Plus size={16}/> Create creator</button>
            </form>
            <div className="list-stack">
              {creators.map(c => <div className="list-row" key={c.id}><div><strong>{c.display_name}</strong><span>@{c.username}</span></div><span className={`pill ${c.is_active ? "success" : ""}`}>{c.is_active ? "Active" : "Disabled"}</span></div>)}
            </div>
          </section>

          <section id="reviews" className="panel">
            <div className="panel-title"><div><h2>Add a review</h2><p>Reviews are controlled by User A.</p></div><Star/></div>
            <form className="form-stack" onSubmit={addReview}>
              <label>Creator<select name="creator_id" required defaultValue=""><option value="" disabled>Select creator</option>{creators.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>
              <label>Reviewer name<input name="reviewer_name" required placeholder="Alex M." /></label>
              <label>Rating<select name="rating" defaultValue="5">{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} stars</option>)}</select></label>
              <label>Review<textarea name="review_text" required placeholder="Write a short demo review…" /></label>
              <button className="btn primary">Publish review</button>
            </form>
          </section>
        </div>

        <section id="activity" className="panel">
          <div className="panel-title"><div><h2>Recent activity</h2><p>Latest events across creator profiles.</p></div><Activity/></div>
          <div className="activity-table">
            {events.length === 0 ? <p className="muted">No activity yet.</p> : events.map(ev => <div className="activity-row" key={ev.id}><span className="activity-dot"/><strong>{ev.event_type.replaceAll("_", " ")}</strong><span>{new Date(ev.created_at).toLocaleString()}</span></div>)}
          </div>
        </section>
      </section>
    </main>
  );
}
