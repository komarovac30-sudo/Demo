"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3, Check, ChevronRight, Eye, FileImage, Heart, ImagePlus, Images, LockKeyhole, LogOut, Mail,
  Pencil, Phone, RotateCcw, Save, Sparkles, Star, Trash2, Unlock, Upload, Users, X
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";

type Profile = {
  id:string; username:string; display_name:string; bio:string|null; headline:string|null;
  avatar_url:string|null; cover_url:string|null; public_phone:string|null; public_email:string|null;
  phone_visible:boolean; email_visible:boolean; exclusive_price:number; exclusive_currency:string; role:string;
  profile_likes_count?:number;
};
type Media = { id:string; type:"PHOTO"|"VIDEO"; visibility:"PUBLIC"|"LOCKED"; title:string|null; description:string|null; media_url:string; thumbnail_url?:string|null; created_at:string; likes_count?:number };
type Review = { id:string; reviewer_name:string; reviewer_first_name?:string|null; reviewer_last_name?:string|null; reviewer_avatar_url?:string|null; rating:number; review_text:string; is_featured:boolean };
type Analytics = { totals:{ unique_visitors:number; profile_views:number; media_views:number; unlocks:number; likes:number; active_today:number } };
type Payment = { amount:number|string; status:string };
type UploadStage = "idle"|"ready"|"authorizing"|"uploading"|"saving"|"done";

function prettySize(size:number){
  if(size < 1024) return `${size} B`;
  if(size < 1024*1024) return `${(size/1024).toFixed(1)} KB`;
  return `${(size/(1024*1024)).toFixed(1)} MB`;
}

export default function CreatorDashboard() {
  const [ready,setReady]=useState(false); const [authorized,setAuthorized]=useState(false);
  const [profile,setProfile]=useState<Profile|null>(null); const [media,setMedia]=useState<Media[]>([]); const [reviews,setReviews]=useState<Review[]>([]);
  const [analytics,setAnalytics]=useState<Analytics|null>(null); const [payments,setPayments]=useState<Payment[]>([]);
  const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState("");
  const [imageProgress,setImageProgress]=useState(0);
  const [selectedFile,setSelectedFile]=useState<File|null>(null); const [mediaPreview,setMediaPreview]=useState("");
  const [uploadProgress,setUploadProgress]=useState(0); const [uploadStage,setUploadStage]=useState<UploadStage>("idle");
  const [editingProfileLikes,setEditingProfileLikes]=useState(false); const [profileLikesDraft,setProfileLikesDraft]=useState("0");
  const [editingMediaLike,setEditingMediaLike]=useState<string|null>(null); const [mediaLikeDraft,setMediaLikeDraft]=useState("");
  const avatarInput=useRef<HTMLInputElement>(null); const coverInput=useRef<HTMLInputElement>(null); const mediaInput=useRef<HTMLInputElement>(null);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setReady(true);return;}
    const {data:p}=await supabase.from("profiles").select("id,username,display_name,bio,headline,avatar_url,cover_url,public_phone,public_email,phone_visible,email_visible,exclusive_price,exclusive_currency,profile_likes_count,role").eq("id",user.id).single();
    if(!p||p.role!=="CREATOR"){setReady(true);return;} setAuthorized(true); setProfile(p as Profile); setProfileLikesDraft(String(Number(p.profile_likes_count||0)));
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

  useEffect(()=>{
    if(!selectedFile){setMediaPreview("");return;}
    const url=URL.createObjectURL(selectedFile); setMediaPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[selectedFile]);

  function flash(text:string,isError=false){if(isError){setError(text);setMessage("");}else{setMessage(text);setError("");}window.setTimeout(()=>{setMessage("");setError("");},5000);}
  function selectMediaFile(file:File|null){setSelectedFile(file);setUploadProgress(0);setUploadStage(file?"ready":"idle");}

  async function saveProfile(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!profile)return; setBusy("save"); setError("");
    const form=new FormData(e.currentTarget);
    const payload={
      display_name:String(form.get("display_name")||"").trim(),username:String(form.get("username")||"").trim().toLowerCase(),
      headline:String(form.get("headline")||"").trim()||null,bio:String(form.get("bio")||"").trim()||null,
      public_phone:String(form.get("public_phone")||"").trim()||null,public_email:String(form.get("public_email")||"").trim()||null,
      phone_visible:form.get("phone_visible")==="on",email_visible:form.get("email_visible")==="on",
      exclusive_price:Number(form.get("exclusive_price")||0),exclusive_currency:String(form.get("exclusive_currency")||"USD"),updated_at:new Date().toISOString(),
    };
    const {error:updateError}=await supabase.from("profiles").update(payload).eq("id",profile.id);setBusy("");
    if(updateError)flash(updateError.message,true);else{flash("Profile updated successfully.");await load();}
  }

  async function uploadProfileImage(file:File,kind:"avatar"|"cover"){
    if(!profile||!file.size)return;setBusy(kind);setError("");setImageProgress(1);
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("Please sign in again.");
      const cloud=await uploadToCloudinary(file,session.access_token,kind==="avatar"?"profile-avatar":"profile-cover",{onProgress:setImageProgress});
      const field=kind==="avatar"?"avatar_url":"cover_url";
      const {error:updateError}=await supabase.from("profiles").update({[field]:cloud.secure_url,updated_at:new Date().toISOString()}).eq("id",profile.id);
      if(updateError)throw updateError;setProfile(prev=>prev?{...prev,[field]:cloud.secure_url}:prev);flash(kind==="avatar"?"Profile photo updated.":"Cover photo updated.");
    }catch(err){flash(err instanceof Error?err.message:"Upload failed.",true);}finally{setBusy("");setImageProgress(0);}
  }

  async function clearProfileImage(kind:"avatar"|"cover"){
    if(!profile)return;const label=kind==="avatar"?"profile photo":"cover photo";if(!confirm(`Remove your current ${label}?`))return;
    setBusy(`remove-${kind}`);const field=kind==="avatar"?"avatar_url":"cover_url";
    const {error:updateError}=await supabase.from("profiles").update({[field]:null,updated_at:new Date().toISOString()}).eq("id",profile.id);setBusy("");
    if(updateError)flash(updateError.message,true);else{setProfile(prev=>prev?{...prev,[field]:null}:prev);flash(`${kind==="avatar"?"Profile":"Cover"} photo removed.`);}
  }

  async function uploadMedia(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!profile)return;const formEl=e.currentTarget;const form=new FormData(formEl);const file=selectedFile||(form.get("file") as File);
    if(!file?.size){flash("Choose a photo or video first.",true);return;}
    setBusy("media");setError("");setUploadProgress(1);setUploadStage("authorizing");
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("Please sign in again.");
      setUploadStage("uploading");
      const cloud=await uploadToCloudinary(file,session.access_token,"media",{onProgress:setUploadProgress});
      setUploadStage("saving");
      const payload={creator_id:profile.id,type:cloud.resource_type==="video"?"VIDEO":"PHOTO",visibility:String(form.get("visibility")||"PUBLIC"),title:String(form.get("title")||file.name).trim()||file.name,description:String(form.get("description")||"").trim()||null,media_url:cloud.secure_url,thumbnail_url:cloud.resource_type==="video"?cloud.secure_url:null};
      const {data:created,error:insertError}=await supabase.from("media").insert(payload).select("id,type,visibility,title,description,media_url,thumbnail_url,created_at,likes_count").single();
      if(insertError)throw insertError;
      if(created)setMedia(prev=>[created as Media,...prev]);
      setUploadProgress(100);formEl.reset();setSelectedFile(null);setUploadStage("done");flash("Content published and added to your library.");
      window.setTimeout(()=>setUploadStage("idle"),1800);
    }catch(err){setUploadStage(selectedFile?"ready":"idle");flash(err instanceof Error?err.message:"Upload failed.",true);}finally{setBusy("");}
  }

  async function saveDisplayLikes(target:"profile"|"media",mediaId?:string){
    if(!profile)return;const raw=target==="profile"?profileLikesDraft:mediaLikeDraft;const count=Number(raw);
    if(!Number.isInteger(count)||count<0||count>99999999){flash("Like count must be a whole number from 0 to 99,999,999.",true);return;}
    setBusy(target==="profile"?"profile-likes":`media-likes-${mediaId}`);
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("Please sign in again.");
      const res=await fetch("/api/creator/display-likes",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(target==="profile"?{profile_likes_count:count}:{media_id:mediaId,likes_count:count})});
      const body=await res.json();if(!res.ok)throw new Error(body.error||"Unable to update likes.");
      if(target==="profile"){setProfile(prev=>prev?{...prev,profile_likes_count:count}:prev);setEditingProfileLikes(false);}else{setMedia(prev=>prev.map(item=>item.id===mediaId?{...item,likes_count:count}:item));setEditingMediaLike(null);}
      flash("Like count updated.");
    }catch(err){flash(err instanceof Error?err.message:"Unable to update likes.",true);}finally{setBusy("");}
  }

  async function removeMedia(id:string){if(!confirm("Remove this media item?"))return;const {error:removeError}=await supabase.from("media").delete().eq("id",id);if(removeError)flash(removeError.message,true);else{setMedia(prev=>prev.filter(item=>item.id!==id));flash("Media removed.");}}
  async function logout(){await supabase.auth.signOut();location.href="/login";}

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
      <header id="home" className="workspace-header-v5"><div><span className="workspace-kicker"><Sparkles size={14}/> ES STUDIO</span><h1>Welcome back, {profile.display_name.split(" ")[0]}.</h1><p>Update your profile, publish content and see the important numbers without dashboard clutter.</p></div><Link className="btn secondary" href={`/u/${profile.username}`}>View public profile <Eye size={17}/></Link></header>
      {message&&<div className="alert success">{message}</div>}{error&&<div className="alert error">{error}</div>}

      <section className="compact-metrics-v5">
        <article className="metric-v5 primary"><Users/><div><span>Total visitors</span><strong>{analytics?.totals.unique_visitors??0}</strong><small>{analytics?.totals.active_today??0} active in last 24h</small></div></article>
        <article className="metric-v5"><Eye/><div><span>Profile views</span><strong>{analytics?.totals.profile_views??0}</strong><small>All tracked visits</small></div></article>
        <article className="metric-v5 editable-metric-v6"><Heart/><div><span>Profile likes</span>{editingProfileLikes?<div className="inline-like-editor-v6"><input aria-label="Profile likes" type="number" min="0" max="99999999" value={profileLikesDraft} onChange={e=>setProfileLikesDraft(e.target.value)}/><button aria-label="Save profile likes" onClick={()=>saveDisplayLikes("profile")} disabled={busy==="profile-likes"}><Check size={14}/></button><button aria-label="Cancel" onClick={()=>{setEditingProfileLikes(false);setProfileLikesDraft(String(profile.profile_likes_count||0));}}><X size={14}/></button></div>:<><strong>{Number(profile.profile_likes_count||0)}</strong><button className="metric-edit-v6" onClick={()=>setEditingProfileLikes(true)}><Pencil size={12}/> Edit count</button></>}</div></article>
        <article className="metric-v5"><Unlock/><div><span>Unlocks</span><strong>{payments.length||analytics?.totals.unlocks||0}</strong><small>${revenue.toFixed(2)} demo revenue</small></div></article>
      </section>

      <section id="profile" className="workspace-panel-v5 profile-editor-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">MY PUBLIC PROFILE</span><h2>Make the first impression count.</h2><p>Upload your cover and profile image from this device. The location shown publicly is detected from each visitor&apos;s IP/network and is not manually edited here.</p></div><Link href={`/u/${profile.username}`} className="text-link-v5">Open profile <ChevronRight size={16}/></Link></div>
        <div className="profile-visual-editor-v5">
          <div className="cover-title-v6"><div><strong>Cover photo</strong><span>Recommended: wide landscape image, JPG/PNG/WebP</span></div><button className="btn secondary compact" type="button" onClick={()=>coverInput.current?.click()} disabled={busy==="cover"}><Upload size={15}/>{busy==="cover"?`Uploading ${imageProgress}%`:profile.cover_url?"Change cover":"Upload cover"}</button></div>
          <div className="editor-cover-v5" style={profile.cover_url?{backgroundImage:`url(${profile.cover_url})`}:undefined}><div className="cover-upload-overlay-v6"><button type="button" onClick={()=>coverInput.current?.click()} disabled={busy==="cover"}><Upload size={17}/>{busy==="cover"?`${imageProgress}%`:profile.cover_url?"Replace cover":"Upload cover"}</button>{profile.cover_url&&<button className="image-remove-v5" type="button" onClick={()=>clearProfileImage("cover")} disabled={busy==="remove-cover"}><Trash2 size={15}/>{busy==="remove-cover"?"Removing…":"Remove"}</button>}</div>{busy==="cover"&&<div className="image-upload-progress-v6"><span style={{width:`${imageProgress}%`}}/></div>}<input ref={coverInput} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)uploadProfileImage(f,"cover");e.currentTarget.value="";}}/></div>
          <div className="editor-avatar-row-v5"><div className="editor-avatar-v5"><img src={profile.avatar_url||"/demo/avatar-v5.svg"} alt=""/><button type="button" onClick={()=>avatarInput.current?.click()} disabled={busy==="avatar"}><ImagePlus size={17}/></button><input ref={avatarInput} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)uploadProfileImage(f,"avatar");e.currentTarget.value="";}}/></div><div><strong>{profile.display_name}</strong><span>@{profile.username}</span><small>{busy==="avatar"?`Uploading profile photo • ${imageProgress}%`:"JPG, PNG or WebP recommended"}</small>{profile.avatar_url&&<button className="text-danger-v5" type="button" onClick={()=>clearProfileImage("avatar")} disabled={busy==="remove-avatar"}>{busy==="remove-avatar"?"Removing…":"Remove profile photo"}</button>}</div></div>
        </div>
        <form className="profile-form-v5" onSubmit={saveProfile}>
          <div className="two-fields"><label>Display name<input name="display_name" defaultValue={profile.display_name} required/></label><label>Username<input name="username" defaultValue={profile.username} required pattern="[A-Za-z0-9_.]{3,40}"/></label></div>
          <label>Headline<input name="headline" defaultValue={profile.headline||""} maxLength={120} placeholder="Independent profile • Private photo journal"/></label>
          <div className="auto-location-note-v6"><span className="live-dot-v6"/><div><strong>Automatic visitor location</strong><p>The public page detects the current viewer&apos;s approximate city from IP/network data. ES users do not need to set a location manually.</p></div></div>
          <label>About<textarea name="bio" defaultValue={profile.bio||""} rows={5} maxLength={1000}/></label>
          <div className="two-fields"><label><span><Phone size={14}/> Public phone</span><input name="public_phone" defaultValue={profile.public_phone||""} placeholder="+1 (305) 555-0148"/></label><label><span><Mail size={14}/> Public email</span><input name="public_email" type="email" defaultValue={profile.public_email||""} placeholder="hello@example.com"/></label></div>
          <div className="visibility-row-v5"><label className="toggle-row"><input name="phone_visible" type="checkbox" defaultChecked={profile.phone_visible}/><span/>Show phone publicly</label><label className="toggle-row"><input name="email_visible" type="checkbox" defaultChecked={profile.email_visible}/><span/>Show email publicly</label></div>
          <div className="two-fields"><label>Exclusive gallery price<input name="exclusive_price" type="number" min="0" step="0.01" defaultValue={Number(profile.exclusive_price||0)}/></label><label>Currency<select name="exclusive_currency" defaultValue={profile.exclusive_currency||"USD"}><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option></select></label></div>
          <div className="form-actions-v5"><button className="btn primary" disabled={busy==="save"}><Save size={17}/>{busy==="save"?"Saving…":"Save profile"}</button><Link className="btn ghost" href={`/u/${profile.username}`}>Preview public page</Link></div>
        </form>
      </section>

      <section id="post" className="workspace-panel-v5 post-panel-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">NEW CONTENT</span><h2>Post something new.</h2><p>Choose a file, preview it before upload, then publish it to your public or private collection.</p></div><Upload/></div>
        <form className="post-form-v5 upload-flow-v6" onSubmit={uploadMedia}>
          <div className={`dropzone-v5 upload-preview-v6 ${selectedFile?"has-file":""}`} onClick={()=>mediaInput.current?.click()} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")mediaInput.current?.click();}}>
            {selectedFile&&mediaPreview?<>{selectedFile.type.startsWith("video/")?<video src={mediaPreview} muted playsInline/>:<img src={mediaPreview} alt="Selected media preview"/>}<div className="upload-preview-shade-v6"/><div className="selected-file-badge-v6"><FileImage size={16}/><div><strong>{selectedFile.name}</strong><span>{prettySize(selectedFile.size)} • {selectedFile.type.startsWith("video/")?"Video":"Photo"}</span></div></div><button className="change-file-v6" type="button" onClick={e=>{e.stopPropagation();mediaInput.current?.click();}}><RotateCcw size={14}/> Change</button><button className="clear-file-v6" type="button" onClick={e=>{e.stopPropagation();selectMediaFile(null);if(mediaInput.current)mediaInput.current.value="";}}><X size={14}/></button></>:<><Upload size={27}/><strong>Choose photo or video</strong><span>Click to browse from your computer or phone</span><small>Preview appears here before anything is published.</small></>}
            <input ref={mediaInput} name="file" type="file" accept="image/*,video/*" hidden onChange={e=>selectMediaFile(e.target.files?.[0]||null)}/>
          </div>
          <div className="post-fields-v5"><label>Title<input name="title" maxLength={120} placeholder="Give this post a title"/></label><label>Description<textarea name="description" rows={3} maxLength={500} placeholder="Optional short caption"/></label><label>Visibility<select name="visibility" defaultValue="PUBLIC"><option value="PUBLIC">Public — anyone can view</option><option value="LOCKED">Private — requires digital unlock</option></select></label>
            {uploadStage!=="idle"&&<div className={`upload-status-v6 ${uploadStage}`}><div><strong>{uploadStage==="ready"?"Ready to publish":uploadStage==="authorizing"?"Preparing secure upload…":uploadStage==="uploading"?`Uploading • ${uploadProgress}%`:uploadStage==="saving"?"Upload complete • saving post…":"Published successfully"}</strong><span>{uploadStage==="ready"?"Your file is selected. Add details and publish when ready.":uploadStage==="done"?"The new item is already visible in Media Library below.":"Please keep this page open until publishing finishes."}</span></div><div className="upload-progress-track-v6"><span style={{width:`${uploadStage==="ready"?0:uploadStage==="saving"||uploadStage==="done"?100:uploadProgress}%`}}/></div></div>}
            <button className="btn premium-cta publish-v6" disabled={busy==="media"||!selectedFile}><Upload size={17}/>{busy==="media"?(uploadStage==="saving"?"Saving post…":`Uploading ${uploadProgress}%`):"Publish content"}</button>
          </div>
        </form>
      </section>

      <section id="library" className="workspace-panel-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">MEDIA LIBRARY</span><h2>Your recent content</h2><p>{media.length} total items • {media.filter(m=>m.visibility==="LOCKED").length} private • like counts can be adjusted per item</p></div><Images/></div>
        {media.length===0?<div className="empty-card-v5">No content yet. Use “Post something new” above.</div>:<div className="creator-media-library-v5">{media.slice(0,12).map(item=><article key={item.id}><div className="library-thumb-v5">{item.type==="VIDEO"?<video src={item.media_url} muted/>:<img src={item.media_url} alt={item.title||"media"}/>}<span className={`visibility-badge ${item.visibility==="LOCKED"?"locked":""}`}>{item.visibility==="LOCKED"?<><LockKeyhole size={11}/>Private</>:"Public"}</span></div><div className="library-meta-v5 library-meta-v6"><div><strong>{item.title||"Untitled"}</strong>{editingMediaLike===item.id?<div className="inline-like-editor-v6 media"><input aria-label="Media likes" type="number" min="0" max="99999999" value={mediaLikeDraft} onChange={e=>setMediaLikeDraft(e.target.value)}/><button onClick={()=>saveDisplayLikes("media",item.id)} disabled={busy===`media-likes-${item.id}`}><Check size={13}/></button><button onClick={()=>setEditingMediaLike(null)}><X size={13}/></button></div>:<button className="media-like-edit-v6" onClick={()=>{setEditingMediaLike(item.id);setMediaLikeDraft(String(Number(item.likes_count||0)));}}><Heart size={12}/>{item.likes_count||0} likes <Pencil size={11}/></button>}</div><button className="remove-media-v6" onClick={()=>removeMedia(item.id)}>Remove</button></div></article>)}</div>}
      </section>

      <section className="advanced-entry-v5"><div className="advanced-icon"><BarChart3/></div><div><span className="workspace-kicker">ADVANCED</span><h2>Visitor Intelligence & deeper analytics</h2><p>Unique visitor/IP rows, session history, device/location signals, content interest and activity journey live here — away from your everyday Home screen.</p></div><Link className="btn secondary" href="/dashboard/visitors">Open Advanced <ChevronRight size={17}/></Link></section>

      <section id="reviews" className="workspace-panel-v5"><div className="panel-head-v5"><div><span className="workspace-kicker">REVIEWS</span><h2>Your public reputation</h2><p>{rating?`${rating.toFixed(1)} average from ${reviews.length} published reviews`:"No published reviews yet."}</p></div><Star/></div>{reviews.length===0?<div className="empty-card-v5">Published reviews will appear here after Admin moderation.</div>:<div className="dashboard-review-grid-v5">{reviews.slice(0,4).map(r=><article key={r.id}><img src={r.reviewer_avatar_url||"/demo/reviewers/default-reviewer.svg"} alt=""/><div><span className="review-stars">{"★".repeat(r.rating)}</span><p>“{r.review_text}”</p><strong>{r.reviewer_first_name?`${r.reviewer_first_name} ${r.reviewer_last_name||""}`:r.reviewer_name}</strong></div></article>)}</div>}</section>
    </section>
  </main>;
}
