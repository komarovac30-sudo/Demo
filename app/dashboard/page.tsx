"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3, ChevronRight, Eye, Heart, ImagePlus, Images, LockKeyhole, LogOut, Mail, MapPin,
  Phone, Save, ShieldCheck, Sparkles, Star, Unlock, Upload, Users
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";

type Profile = {
  id:string; username:string; display_name:string; bio:string|null; headline:string|null; location_label:string|null;
  avatar_url:string|null; cover_url:string|null; public_phone:string|null; public_email:string|null;
  phone_visible:boolean; email_visible:boolean; exclusive_price:number; exclusive_currency:string; role:string;
};
type Media = { id:string; type:"PHOTO"|"VIDEO"; visibility:"PUBLIC"|"LOCKED"; title:string|null; description:string|null; media_url:string; thumbnail_url?:string|null; created_at:string; likes_count?:number };
type Review = { id:string; reviewer_name:string; reviewer_first_name?:string|null; reviewer_last_name?:string|null; reviewer_avatar_url?:string|null; rating:number; review_text:string; is_featured:boolean };
type Analytics = { totals:{ unique_visitors:number; profile_views:number; media_views:number; unlocks:number; likes:number; active_today:number } };
type Payment = { amount:number|string; status:string };

export default function CreatorDashboard() {
  const [ready,setReady]=useState(false); const [authorized,setAuthorized]=useState(false);
  const [profile,setProfile]=useState<Profile|null>(null); const [media,setMedia]=useState<Media[]>([]); const [reviews,setReviews]=useState<Review[]>([]);
  const [analytics,setAnalytics]=useState<Analytics|null>(null); const [payments,setPayments]=useState<Payment[]>([]);
  const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState("");
  const avatarInput=useRef<HTMLInputElement>(null); const coverInput=useRef<HTMLInputElement>(null);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setReady(true);return;}
    const {data:p}=await supabase.from("profiles").select("id,username,display_name,bio,headline,location_label,avatar_url,cover_url,public_phone,public_email,phone_visible,email_visible,exclusive_price,exclusive_currency,role").eq("id",user.id).single();
    if(!p||p.role!=="CREATOR"){setReady(true);return;} setAuthorized(true); setProfile(p as Profile);
    const [{data:m},{data:r},{data:pay},{data:{session}}]=await Promise.all([
      supabase.from("media").select("id,type,visibility,title,description,media_url,thumbnail_url,created_at,likes_count").eq("creator_id",user.id).order("created_at",{ascending:false}),
      supabase.from("reviews").select("id,reviewer_name,reviewer_first_name,reviewer_last_name,reviewer_avatar_url,rating,review_text,is_featured").eq("creator_id",user.id).eq("is_published",true).order("is_featured",{ascending:false}),
      supabase.from("payments").select("amount,status").eq("creator_id",user.id).eq("status","CONFIRMED"),
      supabase.auth.getSession(),
    ]);
    setMedia((m||[]) as Media[]); setReviews((r||[]) as Review[]); setPayments((pay||[]) as Payment[]);
    if(session?.access_token){const res=await fetch("/api/analytics/visitors",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});if(res.ok)setAnalytics(await res.json() as Analytics);}
    setReady(true);
  },[]);
  useEffect(()=>{load();},[load]);

  function flash(text:string, isError=false){ if(isError){setError(text);setMessage("");}else{setMessage(text);setError("");} window.setTimeout(()=>{setMessage("");setError("");},5000); }

  async function saveProfile(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!profile)return; setBusy("save"); setError("");
    const form=new FormData(e.currentTarget);
    const payload={
      display_name:String(form.get("display_name")||"").trim(), username:String(form.get("username")||"").trim().toLowerCase(),
      headline:String(form.get("headline")||"").trim()||null, location_label:String(form.get("location_label")||"").trim()||null,
      bio:String(form.get("bio")||"").trim()||null, public_phone:String(form.get("public_phone")||"").trim()||null,
      public_email:String(form.get("public_email")||"").trim()||null, phone_visible:form.get("phone_visible")==="on", email_visible:form.get("email_visible")==="on",
      exclusive_price:Number(form.get("exclusive_price")||0), exclusive_currency:String(form.get("exclusive_currency")||"USD"), updated_at:new Date().toISOString(),
    };
    const {error:updateError}=await supabase.from("profiles").update(payload).eq("id",profile.id); setBusy("");
    if(updateError)flash(updateError.message,true);else{flash("Profile updated successfully.");await load();}
  }

  async function uploadProfileImage(file:File, kind:"avatar"|"cover"){
    if(!profile||!file.size)return; setBusy(kind); setError("");
    try{
      const {data:{session}}=await supabase.auth.getSession(); if(!session?.access_token)throw new Error("Please sign in again.");
      const cloud=await uploadToCloudinary(file,session.access_token,kind==="avatar"?"profile-avatar":"profile-cover");
      const field=kind==="avatar"?"avatar_url":"cover_url";
      const {error:updateError}=await supabase.from("profiles").update({[field]:cloud.secure_url,updated_at:new Date().toISOString()}).eq("id",profile.id);
      if(updateError)throw updateError; flash(kind==="avatar"?"Profile photo updated.":"Cover photo updated."); await load();
    }catch(err){flash(err instanceof Error?err.message:"Upload failed.",true);}finally{setBusy("");}
  }


  async function clearProfileImage(kind:"avatar"|"cover") {
    if (!profile) return;
    const label = kind === "avatar" ? "profile photo" : "cover photo";
    if (!confirm(`Remove your current ${label}?`)) return;
    setBusy(`remove-${kind}`);
    const field = kind === "avatar" ? "avatar_url" : "cover_url";
    const { error: updateError } = await supabase.from("profiles").update({ [field]: null, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setBusy("");
    if (updateError) flash(updateError.message, true);
    else { flash(`${kind === "avatar" ? "Profile" : "Cover"} photo removed.`); await load(); }
  }

  async function uploadMedia(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!profile)return; setBusy("media"); setError("");
    const form=new FormData(e.currentTarget);
    try{
      const file=form.get("file") as File; if(!file?.size)throw new Error("Choose a photo or video.");
      const {data:{session}}=await supabase.auth.getSession(); if(!session?.access_token)throw new Error("Please sign in again.");
      const cloud=await uploadToCloudinary(file,session.access_token,"media");
      const {error:insertError}=await supabase.from("media").insert({creator_id:profile.id,type:cloud.resource_type==="video"?"VIDEO":"PHOTO",visibility:String(form.get("visibility")||"PUBLIC"),title:String(form.get("title")||file.name).trim(),description:String(form.get("description")||"").trim()||null,media_url:cloud.secure_url,thumbnail_url:cloud.resource_type==="video"?cloud.secure_url:null});
      if(insertError)throw insertError; e.currentTarget.reset(); flash("New content published."); await load();
    }catch(err){flash(err instanceof Error?err.message:"Upload failed.",true);}finally{setBusy("");}
  }

  async function removeMedia(id:string){if(!confirm("Remove this media item?"))return;const {error:removeError}=await supabase.from("media").delete().eq("id",id);if(removeError)flash(removeError.message,true);else{flash("Media removed.");await load();}}
  async function logout(){await supabase.auth.signOut();location.href="/login";}

  const totalLikes=useMemo(()=>media.reduce((sum,item)=>sum+Number(item.likes_count||0),0),[media]);
  const revenue=useMemo(()=>payments.reduce((sum,p)=>sum+Number(p.amount||0),0),[payments]);
  const rating=useMemo(()=>reviews.length?reviews.reduce((s,r)=>s+r.rating,0)/reviews.length:0,[reviews]);

  if(!ready)return <div className="center-screen"><span className="loader-orb"/><p>Opening studio…</p></div>;
  if(!authorized||!profile)return <div className="center-screen"><div className="friendly-error"><h2>ES Studio access required</h2><Link className="btn primary" href="/login">Go to login</Link></div></div>;

  return <main className="dashboard-page-v5">
    <aside className="dashboard-sidebar-v5">
      <Link href="/" className="veloura-brand"><span>V</span>VELOURA</Link><div className="workspace-label">ES Studio</div>
      <nav><a className="active" href="#home">Home</a><a href="#profile">My profile</a><a href="#post">Post content</a><a href="#library">Media library</a><Link href="/dashboard/visitors">Advanced</Link><a href="#reviews">Reviews</a></nav>
      <div className="sidebar-user-v5"><img src={profile.avatar_url||"/demo/avatar-v5.svg"} alt=""/><div><strong>{profile.display_name}</strong><span>@{profile.username}</span></div></div>
      <button className="sidebar-logout" onClick={logout}><LogOut size={17}/> Log out</button>
    </aside>

    <section className="dashboard-content-v5">
      <header id="home" className="workspace-header-v5"><div><span className="workspace-kicker"><Sparkles size={14}/> ES STUDIO</span><h1>Welcome back, {profile.display_name.split(" ")[0]}.</h1><p>Keep your profile fresh, post new content and check the numbers that matter.</p></div><Link className="btn secondary" href={`/u/${profile.username}`}>View public profile <Eye size={17}/></Link></header>
      {message&&<div className="alert success">{message}</div>}{error&&<div className="alert error">{error}</div>}

      <section className="compact-metrics-v5">
        <article className="metric-v5 primary"><Users/><div><span>Total visitors</span><strong>{analytics?.totals.unique_visitors??0}</strong><small>{analytics?.totals.active_today??0} active in last 24h</small></div></article>
        <article className="metric-v5"><Eye/><div><span>Profile views</span><strong>{analytics?.totals.profile_views??0}</strong><small>All tracked visits</small></div></article>
        <article className="metric-v5"><Heart/><div><span>Total likes</span><strong>{totalLikes}</strong><small>Across {media.length} posts</small></div></article>
        <article className="metric-v5"><Unlock/><div><span>Unlocks</span><strong>{payments.length||analytics?.totals.unlocks||0}</strong><small>${revenue.toFixed(2)} demo revenue</small></div></article>
      </section>

      <section id="profile" className="workspace-panel-v5 profile-editor-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">MY PUBLIC PROFILE</span><h2>Make the first impression count.</h2><p>Change your cover and profile photo directly from your device, then update the information visitors see.</p></div><Link href={`/u/${profile.username}`} className="text-link-v5">Open profile <ChevronRight size={16}/></Link></div>
        <div className="profile-visual-editor-v5">
          <div className="editor-cover-v5" style={profile.cover_url?{backgroundImage:`url(${profile.cover_url})`}:undefined}><div className="image-edit-actions-v5"><button type="button" onClick={()=>coverInput.current?.click()} disabled={busy==="cover"}><Upload size={16}/>{busy==="cover"?"Uploading…":"Change cover"}</button>{profile.cover_url&&<button className="image-remove-v5" type="button" onClick={()=>clearProfileImage("cover")} disabled={busy==="remove-cover"}>{busy==="remove-cover"?"Removing…":"Remove"}</button>}</div><input ref={coverInput} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)uploadProfileImage(f,"cover");}}/></div>
          <div className="editor-avatar-row-v5"><div className="editor-avatar-v5"><img src={profile.avatar_url||"/demo/avatar-v5.svg"} alt=""/><button type="button" onClick={()=>avatarInput.current?.click()} disabled={busy==="avatar"}><ImagePlus size={17}/></button><input ref={avatarInput} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)uploadProfileImage(f,"avatar");}}/></div><div><strong>{profile.display_name}</strong><span>@{profile.username}</span><small>JPG, PNG or WebP recommended</small>{profile.avatar_url&&<button className="text-danger-v5" type="button" onClick={()=>clearProfileImage("avatar")} disabled={busy==="remove-avatar"}>{busy==="remove-avatar"?"Removing…":"Remove profile photo"}</button>}</div></div>
        </div>
        <form className="profile-form-v5" onSubmit={saveProfile}>
          <div className="two-fields"><label>Display name<input name="display_name" defaultValue={profile.display_name} required/></label><label>Username<input name="username" defaultValue={profile.username} required pattern="[A-Za-z0-9_.]{3,40}"/></label></div>
          <div className="two-fields"><label>Headline<input name="headline" defaultValue={profile.headline||""} maxLength={120} placeholder="Independent companion • Private photo journal"/></label><label>Location label<input name="location_label" defaultValue={profile.location_label||""} maxLength={120} placeholder="Miami, Florida"/></label></div>
          <label>About<textarea name="bio" defaultValue={profile.bio||""} rows={5} maxLength={1000}/></label>
          <div className="two-fields"><label><span><Phone size={14}/> Public phone</span><input name="public_phone" defaultValue={profile.public_phone||""} placeholder="+1 (305) 555-0148"/></label><label><span><Mail size={14}/> Public email</span><input name="public_email" type="email" defaultValue={profile.public_email||""} placeholder="hello@example.com"/></label></div>
          <div className="visibility-row-v5"><label className="toggle-row"><input name="phone_visible" type="checkbox" defaultChecked={profile.phone_visible}/><span/>Show phone publicly</label><label className="toggle-row"><input name="email_visible" type="checkbox" defaultChecked={profile.email_visible}/><span/>Show email publicly</label></div>
          <div className="two-fields"><label>Exclusive gallery price<input name="exclusive_price" type="number" min="0" step="0.01" defaultValue={Number(profile.exclusive_price||0)}/></label><label>Currency<select name="exclusive_currency" defaultValue={profile.exclusive_currency||"USD"}><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option></select></label></div>
          <div className="form-actions-v5"><button className="btn primary" disabled={busy==="save"}><Save size={17}/>{busy==="save"?"Saving…":"Save profile"}</button><Link className="btn ghost" href={`/u/${profile.username}`}>Preview public page</Link></div>
        </form>
      </section>

      <section id="post" className="workspace-panel-v5 post-panel-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">NEW CONTENT</span><h2>Post something new.</h2><p>Upload a photo or video and choose whether it is public or part of your private collection.</p></div><Upload/></div>
        <form className="post-form-v5" onSubmit={uploadMedia}><label className="dropzone-v5"><Upload size={24}/><strong>Choose photo or video</strong><span>Upload from your computer or phone</span><input name="file" type="file" accept="image/*,video/*" required/></label><div className="post-fields-v5"><label>Title<input name="title" maxLength={120} placeholder="Give this post a title"/></label><label>Description<textarea name="description" rows={3} maxLength={500} placeholder="Optional short caption"/></label><label>Visibility<select name="visibility" defaultValue="PUBLIC"><option value="PUBLIC">Public — anyone can view</option><option value="LOCKED">Private — requires digital unlock</option></select></label><button className="btn premium-cta" disabled={busy==="media"}><Upload size={17}/>{busy==="media"?"Uploading…":"Publish content"}</button></div></form>
      </section>

      <section id="library" className="workspace-panel-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">MEDIA LIBRARY</span><h2>Your recent content</h2><p>{media.length} total items • {media.filter(m=>m.visibility==="LOCKED").length} private</p></div><Images/></div>
        {media.length===0?<div className="empty-card-v5">No content yet. Use “Post something new” above.</div>:<div className="creator-media-library-v5">{media.slice(0,8).map(item=><article key={item.id}><div className="library-thumb-v5">{item.type==="VIDEO"?<video src={item.media_url} muted/>:<img src={item.media_url} alt={item.title||"media"}/>}<span className={`visibility-badge ${item.visibility==="LOCKED"?"locked":""}`}>{item.visibility==="LOCKED"?<><LockKeyhole size={11}/>Private</>:"Public"}</span></div><div className="library-meta-v5"><div><strong>{item.title||"Untitled"}</strong><span>{item.likes_count||0} likes</span></div><button onClick={()=>removeMedia(item.id)}>Remove</button></div></article>)}</div>}
      </section>

      <section className="advanced-entry-v5"><div className="advanced-icon"><BarChart3/></div><div><span className="workspace-kicker">ADVANCED</span><h2>Visitor Intelligence & deeper analytics</h2><p>Unique visitor/IP rows, session history, device/location signals, content interest and activity journey live here — away from your everyday Home screen.</p></div><Link className="btn secondary" href="/dashboard/visitors">Open Advanced <ChevronRight size={17}/></Link></section>

      <section id="reviews" className="workspace-panel-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">REVIEWS</span><h2>Your public reputation</h2><p>{rating?`${rating.toFixed(1)} average from ${reviews.length} published reviews`:"No published reviews yet."}</p></div><Star/></div>
        {reviews.length===0?<div className="empty-card-v5">Published reviews will appear here after Admin moderation.</div>:<div className="dashboard-review-grid-v5">{reviews.slice(0,4).map(r=><article key={r.id}><img src={r.reviewer_avatar_url||"/demo/reviewers/default-reviewer.svg"} alt=""/><div><span className="review-stars">{"★".repeat(r.rating)}</span><p>“{r.review_text}”</p><strong>{r.reviewer_first_name?`${r.reviewer_first_name} ${r.reviewer_last_name||""}`:r.reviewer_name}</strong></div></article>)}</div>}
      </section>
    </section>
  </main>;
}
