"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, ChevronRight, Eye, Heart, ImagePlus, Images, LogOut, MapPin, Play, Save, Sparkles, Unlock, Upload, Users } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Profile = { id: string; username: string; display_name: string; bio: string | null; avatar_url: string | null; cover_url: string | null; role: string };
type Media = { id: string; type: "PHOTO"|"VIDEO"; visibility: "PUBLIC"|"LOCKED"; title: string|null; media_url: string; created_at: string; likes_count?: number };
type Review = { id: string; reviewer_name: string; rating: number; review_text: string; is_featured: boolean };
type Visitor = { key:string; ip_address:string; city:string|null; country:string|null; device_type:string; browser:string; os:string; visits:number; media_views:number; likes:number; unlocks:number; last_seen:string; active_now:boolean };
type Analytics = { totals:{ unique_visitors:number; profile_views:number; media_views:number; unlocks:number; likes:number; active_today:number }; visitors:Visitor[] };

function relative(value:string){ const s=Math.floor((Date.now()-new Date(value).getTime())/1000); if(s<60)return"Just now";if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`; }

export default function CreatorDashboard() {
  const [ready,setReady]=useState(false); const [authorized,setAuthorized]=useState(false); const [profile,setProfile]=useState<Profile|null>(null);
  const [media,setMedia]=useState<Media[]>([]); const [reviews,setReviews]=useState<Review[]>([]); const [analytics,setAnalytics]=useState<Analytics|null>(null);
  const [message,setMessage]=useState(""); const [uploading,setUploading]=useState(false);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setReady(true);return;}
    const {data:p}=await supabase.from("profiles").select("id,username,display_name,bio,avatar_url,cover_url,role").eq("id",user.id).single();
    if(!p||p.role!=="CREATOR"){setReady(true);return;} setAuthorized(true); setProfile(p as Profile);
    const [{data:m},{data:r},{data:{session}}]=await Promise.all([
      supabase.from("media").select("id,type,visibility,title,media_url,created_at,likes_count").eq("creator_id",user.id).order("created_at",{ascending:false}),
      supabase.from("reviews").select("id,reviewer_name,rating,review_text,is_featured").eq("creator_id",user.id).eq("is_published",true).order("is_featured",{ascending:false}),
      supabase.auth.getSession(),
    ]);
    setMedia((m||[]) as Media[]); setReviews((r||[]) as Review[]);
    if(session?.access_token){ const res=await fetch("/api/analytics/visitors",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"}); if(res.ok)setAnalytics(await res.json() as Analytics); }
    setReady(true);
  },[]);
  useEffect(()=>{load();},[load]);

  async function saveProfile(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);setMessage("");const {error}=await supabase.from("profiles").update({display_name:form.get("display_name"),username:form.get("username"),bio:form.get("bio"),avatar_url:form.get("avatar_url")||null,cover_url:form.get("cover_url")||null,updated_at:new Date().toISOString()}).eq("id",profile!.id);setMessage(error?error.message:"Profile updated.");if(!error)await load();}
  async function uploadFile(e:FormEvent<HTMLFormElement>){e.preventDefault();setMessage("");setUploading(true);try{const form=new FormData(e.currentTarget);const file=form.get("file") as File;const title=String(form.get("title")||"");const visibility=String(form.get("visibility")||"PUBLIC");if(!file?.size)throw new Error("Choose a photo or video.");const {data:{session}}=await supabase.auth.getSession();const signRes=await fetch("/api/cloudinary/sign",{method:"POST",headers:{Authorization:`Bearer ${session?.access_token||""}`}});const sign=await signRes.json();if(!signRes.ok)throw new Error(sign.error||"Unable to authorize upload.");const uploadForm=new FormData();uploadForm.append("file",file);uploadForm.append("api_key",sign.apiKey);uploadForm.append("timestamp",String(sign.timestamp));uploadForm.append("signature",sign.signature);uploadForm.append("folder",sign.folder);const cloudRes=await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`,{method:"POST",body:uploadForm});const cloud=await cloudRes.json();if(!cloudRes.ok)throw new Error(cloud.error?.message||"Cloudinary upload failed.");const {error}=await supabase.from("media").insert({creator_id:profile!.id,type:cloud.resource_type==="video"?"VIDEO":"PHOTO",visibility,title:title||file.name,media_url:cloud.secure_url,thumbnail_url:cloud.resource_type==="video"?cloud.secure_url:null});if(error)throw error;setMessage("Media uploaded successfully.");e.currentTarget.reset();await load();}catch(err){setMessage(err instanceof Error?err.message:"Upload failed.");}finally{setUploading(false);}}
  async function removeMedia(id:string){if(!confirm("Remove this item from your media library?"))return;await supabase.from("media").delete().eq("id",id);await load();}
  async function logout(){await supabase.auth.signOut();location.href="/login";}

  if(!ready)return <div className="center-screen">Loading creator studio…</div>;
  if(!authorized||!profile)return <div className="center-screen"><div><h2>Creator access required</h2><Link className="btn primary" href="/login">Go to login</Link></div></div>;
  const totalLikes=media.reduce((sum,item)=>sum+Number(item.likes_count||0),0); const averageRating=reviews.length?reviews.reduce((s,r)=>s+r.rating,0)/reviews.length:0;

  return <main className="dashboard-page creator-dashboard">
    <aside className="sidebar luxury-sidebar"><Link href="/" className="brand">CreatorSpace<span>Demo</span></Link><div className="sidebar-role">Creator Studio</div><nav><a className="active" href="#overview">Overview</a><a href="#profile">Profile</a><a href="#content">Media</a><Link href="/dashboard/visitors">Visitors</Link><a href="#analytics">Analytics</a><a href="#reviews">Reviews</a></nav><div className="sidebar-profile"><img src={profile.avatar_url||"/demo/avatar.svg"} alt=""/><div><strong>{profile.display_name}</strong><span>@{profile.username}</span></div></div><button className="btn ghost wide" onClick={logout}><LogOut size={17}/> Log out</button></aside>
    <section className="dashboard-main studio-main">
      <div id="overview" className="dashboard-header studio-header"><div><div className="eyebrow"><Sparkles size={15}/> Creator studio</div><h1>Welcome back, {profile.display_name.split(" ")[0]}.</h1><p className="header-subtitle">Your content, audience and profile — in one calm workspace.</p></div><Link className="btn secondary" href={`/u/${profile.username}`}>View public profile <Eye size={17}/></Link></div>
      {message&&<div className="alert success floating-alert">{message}</div>}

      <div className="studio-kpis">
        <div className="metric-card hero-metric"><Eye/><span>Profile views</span><strong>{analytics?.totals.profile_views??0}</strong><small>{analytics?.totals.unique_visitors??0} unique visitors</small></div>
        <div className="metric-card"><Users/><span>Visitors</span><strong>{analytics?.totals.unique_visitors??0}</strong><small>{analytics?.totals.active_today??0} active in 24h</small></div>
        <div className="metric-card"><Heart/><span>Total likes</span><strong>{totalLikes}</strong><small>Across your media</small></div>
        <div className="metric-card"><Unlock/><span>Unlocks</span><strong>{analytics?.totals.unlocks??0}</strong><small>Exclusive access</small></div>
        <div className="metric-card"><Images/><span>Media</span><strong>{media.length}</strong><small>{media.filter(m=>m.visibility==="LOCKED").length} exclusive</small></div>
      </div>

      <div id="analytics" className="studio-overview-grid">
        <section className="panel audience-preview"><div className="panel-title"><div><h2>Recent visitors</h2><p>One row per captured IP, not one row per event.</p></div><Link href="/dashboard/visitors" className="text-link">View intelligence <ChevronRight size={15}/></Link></div>
          {!analytics?.visitors.length?<div className="empty-state">Visitor activity will appear here after profile visits.</div>:<div className="dashboard-visitor-list">{analytics.visitors.slice(0,5).map(v=><Link href={`/dashboard/visitors/${v.key}`} className="dashboard-visitor-row" key={v.key}><span className={`visitor-status ${v.active_now?"online":""}`}/><div className="dash-visitor-identity"><strong>{v.ip_address}</strong><span><MapPin size={12}/>{v.city||"Location unavailable"}{v.country?`, ${v.country}`:""}</span></div><div className="dash-visitor-device"><span>{v.device_type}</span><small>{v.browser} • {v.os}</small></div><div className="dash-visitor-counts"><b>{v.visits}</b><small>visits</small></div><time>{relative(v.last_seen)}</time><ChevronRight size={17}/></Link>)}</div>}
        </section>
        <section className="panel creator-snapshot"><div className="panel-title"><div><h2>Profile pulse</h2><p>A quick health check.</p></div><BarChart3/></div><div className="pulse-score"><span>Audience score</span><strong>{Math.min(99,55+Math.min(analytics?.totals.unique_visitors||0,20)+Math.min(totalLikes,24))}</strong><em>/ 100</em></div><div className="pulse-bars"><div><span>Media library</span><i><b style={{width:`${Math.min(100,media.length*12)}%`}}/></i></div><div><span>Engagement</span><i><b style={{width:`${Math.min(100,totalLikes/4)}%`}}/></i></div><div><span>Reviews</span><i><b style={{width:`${Math.min(100,reviews.length*22)}%`}}/></i></div></div><div className="rating-chip"><span>Community rating</span><strong>{averageRating?averageRating.toFixed(1):"New"}</strong></div></section>
      </div>

      <div className="dashboard-grid editor-grid">
        <section id="profile" className="panel"><div className="panel-title"><div><h2>Profile presentation</h2><p>Shape the cinematic page visitors see.</p></div><Save/></div><form className="form-stack" onSubmit={saveProfile}><label>Display name<input name="display_name" defaultValue={profile.display_name} required/></label><label>Username<input name="username" defaultValue={profile.username} required/></label><label>Bio<textarea name="bio" defaultValue={profile.bio||""}/></label><label>Avatar URL<input name="avatar_url" defaultValue={profile.avatar_url||""} placeholder="Optional image URL"/></label><label>Cover URL<input name="cover_url" defaultValue={profile.cover_url||""} placeholder="Optional image URL"/></label><button className="btn primary"><Save size={17}/> Save profile</button></form></section>
        <section className="panel"><div className="panel-title"><div><h2>Publish media</h2><p>Photos and video go directly to Cloudinary.</p></div><Upload/></div><form className="form-stack" onSubmit={uploadFile}><label>Title<input name="title" placeholder="Name this moment"/></label><label>Visibility<select name="visibility" defaultValue="PUBLIC"><option value="PUBLIC">Public</option><option value="LOCKED">Exclusive / Locked</option></select></label><label className="file-drop luxury-drop"><ImagePlus/><span>Drop in a photo or video</span><small>or click to browse</small><input name="file" type="file" accept="image/*,video/*" required/></label><button className="btn primary" disabled={uploading}>{uploading?"Uploading…":"Upload media"}</button></form></section>
      </div>

      <section id="content" className="panel media-library-panel"><div className="panel-title"><div><h2>Media library</h2><p>Manage public and exclusive posts.</p></div><Play/></div>{media.length===0?<div className="empty-state">No media yet.</div>:<div className="media-admin-grid luxury-admin-grid">{media.map(item=><article className="media-admin-card" key={item.id}>{item.type==="VIDEO"?<video src={item.media_url} muted/>:<img src={item.media_url} alt={item.title||"media"}/>}<div className="media-admin-info"><div><strong>{item.title||"Untitled"}</strong><span>{Number(item.likes_count||0)} likes</span></div><span className={`pill ${item.visibility==="LOCKED"?"exclusive-pill":""}`}>{item.visibility==="LOCKED"?"Exclusive":"Public"}</span></div><button onClick={()=>removeMedia(item.id)}>Remove</button></article>)}</div>}</section>

      <section id="reviews" className="panel reviews-dashboard-panel"><div className="panel-title"><div><h2>Community reviews</h2><p>Published reviews managed by Super Admin.</p></div><Heart/></div>{reviews.length===0?<div className="empty-state">No published reviews yet.</div>:<div className="review-strip">{reviews.slice(0,4).map(r=><article key={r.id}><span>{"★".repeat(r.rating)}</span><p>“{r.review_text}”</p><strong>{r.reviewer_name}</strong></article>)}</div>}</section>
    </section>
  </main>;
}
