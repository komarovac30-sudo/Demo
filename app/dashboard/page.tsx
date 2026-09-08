"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Eye, ImagePlus, LockKeyhole, LogOut, MapPin, MonitorSmartphone, Play, Save, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Profile = { id: string; username: string; display_name: string; bio: string | null; avatar_url: string | null; cover_url: string | null; role: string };
type Media = { id: string; type: "PHOTO"|"VIDEO"; visibility: "PUBLIC"|"LOCKED"; title: string|null; media_url: string; created_at: string };
type EventRow = { event_type: string; created_at: string; metadata: { city?: string|null; country?: string|null; device_type?: string; browser?: string; os?: string } | null };

export default function CreatorDashboard() {
  const [ready, setReady] = useState(false); const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState<Profile|null>(null); const [media, setMedia] = useState<Media[]>([]); const [events, setEvents] = useState<EventRow[]>([]);
  const [message, setMessage] = useState(""); const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setReady(true); return; }
    const { data: p } = await supabase.from("profiles").select("id,username,display_name,bio,avatar_url,cover_url,role").eq("id", user.id).single();
    if (!p || p.role !== "CREATOR") { setReady(true); return; }
    setAuthorized(true); setProfile(p as Profile);
    const [{ data: m }, { data: ev }] = await Promise.all([
      supabase.from("media").select("id,type,visibility,title,media_url,created_at").eq("creator_id", user.id).order("created_at", { ascending: false }),
      supabase.from("activity_events").select("event_type,created_at,metadata").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    setMedia((m || []) as Media[]); setEvents((ev || []) as EventRow[]); setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); setMessage("");
    const { error } = await supabase.from("profiles").update({
      display_name: form.get("display_name"), username: form.get("username"), bio: form.get("bio"),
      avatar_url: form.get("avatar_url") || null, cover_url: form.get("cover_url") || null, updated_at: new Date().toISOString(),
    }).eq("id", profile!.id);
    setMessage(error ? error.message : "Profile updated."); if (!error) await load();
  }

  async function uploadFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage(""); setUploading(true);
    try {
      const form = new FormData(e.currentTarget); const file = form.get("file") as File; const title = String(form.get("title") || ""); const visibility = String(form.get("visibility") || "PUBLIC");
      if (!file?.size) throw new Error("Choose a photo or video.");
      const { data: { session } } = await supabase.auth.getSession();
      const signRes = await fetch("/api/cloudinary/sign", { method: "POST", headers: { Authorization: `Bearer ${session?.access_token || ""}` } });
      const sign = await signRes.json(); if (!signRes.ok) throw new Error(sign.error || "Unable to authorize upload.");
      const uploadForm = new FormData(); uploadForm.append("file", file); uploadForm.append("api_key", sign.apiKey); uploadForm.append("timestamp", String(sign.timestamp)); uploadForm.append("signature", sign.signature); uploadForm.append("folder", sign.folder);
      const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`, { method: "POST", body: uploadForm });
      const cloud = await cloudRes.json(); if (!cloudRes.ok) throw new Error(cloud.error?.message || "Cloudinary upload failed.");
      const { error } = await supabase.from("media").insert({ creator_id: profile!.id, type: cloud.resource_type === "video" ? "VIDEO" : "PHOTO", visibility, title: title || file.name, media_url: cloud.secure_url });
      if (error) throw error;
      setMessage("Media uploaded successfully."); e.currentTarget.reset(); await load();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Upload failed."); }
    finally { setUploading(false); }
  }

  async function removeMedia(id: string) { if (!confirm("Remove this item from the demo feed?")) return; await supabase.from("media").delete().eq("id", id); await load(); }
  async function logout() { await supabase.auth.signOut(); location.href = "/login"; }

  if (!ready) return <div className="center-screen">Loading creator dashboard…</div>;
  if (!authorized || !profile) return <div className="center-screen"><div><h2>Creator access required</h2><Link className="btn primary" href="/login">Go to login</Link></div></div>;

  const views = events.filter(e => e.event_type === "PROFILE_VIEW").length;
  const unlocks = events.filter(e => e.event_type === "UNLOCK_SUCCESS").length;
  const lockedSeen = events.filter(e => e.event_type === "LOCKED_CONTENT_SEEN").length;

  return (
    <main className="dashboard-page">
      <aside className="sidebar">
        <Link href="/" className="brand">CreatorSpace<span>Demo</span></Link>
        <nav><a href="#analytics">Analytics</a><a href="#profile">Profile</a><a href="#upload">Upload</a><a href="#content">Content</a></nav>
        <button className="btn ghost wide" onClick={logout}><LogOut size={17}/> Log out</button>
      </aside>
      <section className="dashboard-main">
        <div className="dashboard-header"><div><div className="eyebrow">Creator dashboard</div><h1>Hello, {profile.display_name}</h1></div><Link className="btn secondary" href={`/u/${profile.username}`}>View public profile <Eye size={17}/></Link></div>
        {message && <div className="alert success">{message}</div>}
        <div id="analytics" className="kpi-grid">
          <div className="kpi"><Eye/><strong>{views}</strong><span>Profile views*</span></div>
          <div className="kpi"><LockKeyhole/><strong>{lockedSeen}</strong><span>Locked views*</span></div>
          <div className="kpi"><BarChart3/><strong>{unlocks}</strong><span>Unlocks*</span></div>
        </div>
        <p className="tiny muted">*Shows the most recent tracked events loaded by this demo dashboard.</p>

        <div className="dashboard-grid">
          <section id="profile" className="panel">
            <div className="panel-title"><div><h2>Edit profile</h2><p>Update what visitors see.</p></div><Save/></div>
            <form className="form-stack" onSubmit={saveProfile}>
              <label>Display name<input name="display_name" defaultValue={profile.display_name} required /></label>
              <label>Username<input name="username" defaultValue={profile.username} required /></label>
              <label>Bio<textarea name="bio" defaultValue={profile.bio || ""} /></label>
              <label>Avatar URL<input name="avatar_url" defaultValue={profile.avatar_url || ""} placeholder="Optional image URL" /></label>
              <label>Cover URL<input name="cover_url" defaultValue={profile.cover_url || ""} placeholder="Optional image URL" /></label>
              <button className="btn primary"><Save size={17}/> Save profile</button>
            </form>
          </section>

          <section id="upload" className="panel">
            <div className="panel-title"><div><h2>Upload media</h2><p>Files upload directly to Cloudinary.</p></div><Upload/></div>
            <form className="form-stack" onSubmit={uploadFile}>
              <label>Title<input name="title" placeholder="New post" /></label>
              <label>Visibility<select name="visibility" defaultValue="PUBLIC"><option value="PUBLIC">Public</option><option value="LOCKED">Locked</option></select></label>
              <label className="file-drop"><ImagePlus/><span>Choose photo or video</span><input name="file" type="file" accept="image/*,video/*" required /></label>
              <button className="btn primary" disabled={uploading}>{uploading ? "Uploading…" : "Upload media"}</button>
            </form>
          </section>
        </div>

        <section className="panel">
          <div className="panel-title"><div><h2>Recent visitor activity</h2><p>Approximate city and device information captured when visitors interact with your profile.</p></div><MapPin/></div>
          {events.length === 0 ? <div className="empty-state">No visitor activity has been tracked yet.</div> : <div className="visitor-log-list">{events.slice(0, 15).map((event, index) => {
            const meta = event.metadata || {};
            return <article className="visitor-log-row" key={`${event.created_at}-${index}`}>
              <span className="activity-dot"/>
              <div className="visitor-log-main"><strong>{event.event_type.replaceAll("_", " ")}</strong><span><MapPin size={13}/>{meta.city || "Location unavailable"}{meta.country ? `, ${meta.country}` : ""}</span></div>
              <div className="visitor-log-device"><MonitorSmartphone size={14}/><span>{meta.device_type || "Unknown device"}{meta.browser ? ` • ${meta.browser}` : ""}{meta.os ? ` • ${meta.os}` : ""}</span></div>
              <time>{new Date(event.created_at).toLocaleString()}</time>
            </article>;
          })}</div>}
        </section>

        <section id="content" className="panel">
          <div className="panel-title"><div><h2>Your content</h2><p>Public and locked posts.</p></div><Play/></div>
          {media.length === 0 ? <div className="empty-state">No media yet. Upload the first item above.</div> : <div className="media-admin-grid">{media.map(item => <article className="media-admin-card" key={item.id}>{item.type === "VIDEO" ? <video src={item.media_url} muted /> : <img src={item.media_url} alt={item.title || "media"}/>}<div><strong>{item.title || "Untitled"}</strong><span className="pill">{item.visibility}</span></div><button onClick={() => removeMedia(item.id)}>Remove</button></article>)}</div>}
        </section>
      </section>
    </main>
  );
}
