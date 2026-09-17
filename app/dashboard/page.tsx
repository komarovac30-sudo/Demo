"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck, BarChart3, Check, ChevronRight, Copy, Eye, FileImage, Heart, ImagePlus, Images, LockKeyhole, LogOut, Mail,
  Pencil, Phone, QrCode, RotateCcw, Save, ShieldCheck, Sparkles, Star, Trash2, Unlock, Upload, Users, X, MessageCircle, LoaderCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { StudioSkeleton } from "@/components/Skeletons";
import CreatorPaymentSettings from "@/components/CreatorPaymentSettings";

type Profile = {
  id:string; username:string; display_name:string; bio:string|null; headline:string|null;
  avatar_url:string|null; cover_url:string|null; public_phone:string|null; public_email:string|null;
  phone_visible:boolean; email_visible:boolean; exclusive_price:number; exclusive_currency:string; role:string;
  profile_likes_count?:number; age?:number|null; height_label?:string|null; body_type?:string|null; ethnicity?:string|null; hair_color?:string|null; eye_color?:string|null; measurements?:string|null; cup_size?:string|null; languages?:string|null; tattoos_piercings?:string|null;
};
type Media = { id:string; type:"PHOTO"|"VIDEO"; visibility:"PUBLIC"|"LOCKED"; title:string|null; description:string|null; media_url:string; thumbnail_url?:string|null; created_at:string; likes_count?:number };
type Review = {
  id:string; reviewer_name:string; reviewer_first_name?:string|null; reviewer_last_name?:string|null; reviewer_avatar_url?:string|null;
  rating:number; review_text:string; is_featured:boolean; is_published?:boolean; status:"PENDING"|"PUBLISHED"|"REJECTED";
  source:"VISITOR"|"ADMIN"|"CREATOR"; created_at:string; verified_at?:string|null;
};
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
  const [reviewAvatarPreview,setReviewAvatarPreview]=useState("");
  const [reviewUploadProgress,setReviewUploadProgress]=useState(0);
  const [siteOrigin,setSiteOrigin]=useState("");
  const avatarInput=useRef<HTMLInputElement>(null); const coverInput=useRef<HTMLInputElement>(null); const mediaInput=useRef<HTMLInputElement>(null); const reviewAvatarInput=useRef<HTMLInputElement>(null);

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser(); if(!user){setReady(true);return;}
    const {data:p}=await supabase.from("profiles").select("id,username,display_name,bio,headline,avatar_url,cover_url,public_phone,public_email,phone_visible,email_visible,exclusive_price,exclusive_currency,profile_likes_count,role,age,height_label,body_type,ethnicity,hair_color,eye_color,measurements,cup_size,languages,tattoos_piercings").eq("id",user.id).single();
    if(!p||p.role!=="CREATOR"){setReady(true);return;} setAuthorized(true); setProfile(p as Profile); setProfileLikesDraft(String(Number(p.profile_likes_count||0)));
    const [{data:m},{data:r},{data:pay},{data:{session}}]=await Promise.all([
      supabase.from("media").select("id,type,visibility,title,description,media_url,thumbnail_url,created_at,likes_count").eq("creator_id",user.id).order("created_at",{ascending:false}),
      supabase.from("reviews").select("id,reviewer_name,reviewer_first_name,reviewer_last_name,reviewer_avatar_url,rating,review_text,is_featured,is_published,status,source,created_at").eq("creator_id",user.id).eq("is_published",true).order("is_featured",{ascending:false}),
      supabase.from("payments").select("amount,status").eq("creator_id",user.id).eq("status","CONFIRMED"),
      supabase.auth.getSession(),
    ]);
    setMedia((m||[]) as Media[]); setReviews((r||[]) as Review[]); setPayments((pay||[]) as Payment[]);
    if(session?.access_token){
      const [analyticsRes,reviewsRes]=await Promise.all([
        fetch("/api/analytics/visitors",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"}),
        fetch("/api/reviews",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"}),
      ]);
      if(analyticsRes.ok)setAnalytics(await analyticsRes.json() as Analytics);
      if(reviewsRes.ok){const body=await reviewsRes.json();setReviews((body.reviews||[]) as Review[]);}
    }
    setReady(true);
  },[]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(typeof window!=="undefined")setSiteOrigin(window.location.origin);},[]);

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
      age:form.get("age")?Number(form.get("age")):null,height_label:String(form.get("height_label")||"").trim()||null,body_type:String(form.get("body_type")||"").trim()||null,ethnicity:String(form.get("ethnicity")||"").trim()||null,
      hair_color:String(form.get("hair_color")||"").trim()||null,eye_color:String(form.get("eye_color")||"").trim()||null,measurements:String(form.get("measurements")||"").trim()||null,cup_size:String(form.get("cup_size")||"").trim()||null,languages:String(form.get("languages")||"").trim()||null,tattoos_piercings:String(form.get("tattoos_piercings")||"").trim()||null,
      exclusive_price:Number(form.get("exclusive_price")||0),exclusive_currency:String(form.get("exclusive_currency")||"USD"),updated_at:new Date().toISOString(),
    };
    const {error:updateError}=await supabase.from("profiles").update(payload).eq("id",profile.id);
    if(updateError){setBusy("");flash(updateError.message,true);return;}
    setProfile(prev=>prev?{...prev,...payload}:prev);
    flash("Profile saved successfully. Your public profile is up to date.");
    await load();
    setBusy("");
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

  async function submitCreatorReview(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!profile)return;const formEl=e.currentTarget;const form=new FormData(formEl);setBusy("review-create");setError("");setReviewUploadProgress(0);
    try{
      const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("Please sign in again.");
      let avatarUrl:string|null=null;const file=form.get("reviewer_avatar") as File;
      if(file?.size){avatarUrl=(await uploadToCloudinary(file,session.access_token,"review-avatar",{onProgress:setReviewUploadProgress})).secure_url;}
      const res=await fetch("/api/reviews",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({
        creator_id:profile.id,reviewer_first_name:form.get("reviewer_first_name"),reviewer_last_name:form.get("reviewer_last_name"),rating:Number(form.get("rating")),review_text:form.get("review_text"),reviewer_avatar_url:avatarUrl
      })});
      const body=await res.json();if(!res.ok)throw new Error(body.error||"Unable to submit review.");
      formEl.reset();if(reviewAvatarInput.current)reviewAvatarInput.current.value="";setReviewAvatarPreview("");setReviewUploadProgress(0);
      flash("Review submitted for Admin verification. It will stay hidden until verified.");await load();
    }catch(err){flash(err instanceof Error?err.message:"Unable to submit review.",true);}finally{setBusy("");setReviewUploadProgress(0);}
  }

  async function removeMedia(id:string){if(!confirm("Remove this media item?"))return;const {error:removeError}=await supabase.from("media").delete().eq("id",id);if(removeError)flash(removeError.message,true);else{setMedia(prev=>prev.filter(item=>item.id!==id));flash("Media removed.");}}
  async function logout(){await supabase.auth.signOut();location.href="/login";}

  const revenue=useMemo(()=>payments.reduce((sum,p)=>sum+Number(p.amount||0),0),[payments]);
  const publishedReviews=useMemo(()=>reviews.filter(r=>r.status==="PUBLISHED"||r.is_published),[reviews]);
  const pendingReviews=useMemo(()=>reviews.filter(r=>r.status==="PENDING"),[reviews]);
  const rating=useMemo(()=>publishedReviews.length?publishedReviews.reduce((sum,r)=>sum+r.rating,0)/publishedReviews.length:0,[publishedReviews]);

  if(!ready)return <StudioSkeleton/>;
  if(!authorized||!profile)return <div className="center-screen"><div className="friendly-error"><h2>ES Studio access required</h2><Link className="btn primary" href="/login">Go to login</Link></div></div>;

  return <main className="dashboard-page-v5">
    <aside className="dashboard-sidebar-v5">
      <Link href="/" className="veloura-brand"><span>V</span>VELOURA</Link><div className="workspace-label">ES Studio</div>
      <nav><a className="active" href="#home">Home</a><a href="#profile">My profile</a><a href="#post">Add to my gallery</a><a href="#library">My gallery</a><a href="#reviews">Client reviews</a><Link href="/dashboard/messages"><MessageCircle size={14}/> Messages</Link><Link href="/dashboard/visitors">Profile visitors</Link><Link href="/dashboard/visitors">Advanced insights</Link></nav>
      <div className="sidebar-user-v5"><img src={profile.avatar_url||"/demo/avatar-v5.svg"} alt=""/><div><strong>{profile.display_name}</strong><span>@{profile.username}</span></div></div>
      <button className="sidebar-logout" onClick={logout}><LogOut size={17}/> Log out</button>
    </aside>

    <section className="dashboard-content-v5">
      <header id="home" className="workspace-header-v5"><div><span className="workspace-kicker"><Sparkles size={14}/> PRIVATE STUDIO</span><h1>Welcome back, {profile.display_name.split(" ")[0]}.</h1><p>Shape your profile, curate your galleries and keep an eye on the numbers that matter.</p></div><Link className="btn secondary" href={`/u/${profile.username}`}>View public profile <Eye size={17}/></Link></header>
      <div className="toast-stack-v16" aria-live="polite">{message&&<div className="alert success toast-v16">{message}</div>}{error&&<div className="alert error toast-v16">{error}</div>}</div>

      <section className="compact-metrics-v5">
        <article className="metric-v5 primary"><Users/><div><span>Total visitors</span><strong>{analytics?.totals.unique_visitors??0}</strong><small>{analytics?.totals.active_today??0} active in last 24h</small></div></article>
        <article className="metric-v5"><Eye/><div><span>Profile views</span><strong>{analytics?.totals.profile_views??0}</strong><small>All tracked visits</small></div></article>
        <article className="metric-v5 editable-metric-v6"><Heart/><div><span>Admirers</span>{editingProfileLikes?<div className="inline-like-editor-v6"><input aria-label="Profile likes" type="number" min="0" max="99999999" value={profileLikesDraft} onChange={e=>setProfileLikesDraft(e.target.value)}/><button aria-label="Save profile likes" onClick={()=>saveDisplayLikes("profile")} disabled={busy==="profile-likes"}><Check size={14}/></button><button aria-label="Cancel" onClick={()=>{setEditingProfileLikes(false);setProfileLikesDraft(String(profile.profile_likes_count||0));}}><X size={14}/></button></div>:<><strong>{Number(profile.profile_likes_count||0)}</strong><button className="metric-edit-v6" onClick={()=>setEditingProfileLikes(true)}><Pencil size={12}/> Edit admirers</button></>}</div></article>
        <article className="metric-v5"><Unlock/><div><span>Unlocks</span><strong>{payments.length||analytics?.totals.unlocks||0}</strong><small>${revenue.toFixed(2)} demo revenue</small></div></article>
      </section>

      <section id="profile" className="workspace-panel-v5 profile-editor-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">MY PROFILE</span><h2>Make the first impression unforgettable.</h2><p>Curate your cover, profile photo, introduction and private contact details from one place. Viewer location is detected automatically.</p></div><Link href={`/u/${profile.username}`} className="text-link-v5">Open profile <ChevronRight size={16}/></Link></div>
        <div className="profile-visual-editor-v5">
          <div className="cover-title-v6"><div><strong>Cover photo</strong><span>Recommended: wide landscape image, JPG/PNG/WebP</span></div><button className="btn secondary compact" type="button" onClick={()=>coverInput.current?.click()} disabled={busy==="cover"}><Upload size={15}/>{busy==="cover"?`Uploading ${imageProgress}%`:profile.cover_url?"Change cover":"Upload cover"}</button></div>
          <div className="editor-cover-v5" style={profile.cover_url?{backgroundImage:`url(${profile.cover_url})`}:undefined}><div className="cover-upload-overlay-v6"><button type="button" onClick={()=>coverInput.current?.click()} disabled={busy==="cover"}><Upload size={17}/>{busy==="cover"?`${imageProgress}%`:profile.cover_url?"Replace cover":"Upload cover"}</button>{profile.cover_url&&<button className="image-remove-v5" type="button" onClick={()=>clearProfileImage("cover")} disabled={busy==="remove-cover"}><Trash2 size={15}/>{busy==="remove-cover"?"Removing…":"Remove"}</button>}</div>{busy==="cover"&&<div className="image-upload-progress-v6"><span style={{width:`${imageProgress}%`}}/></div>}<input ref={coverInput} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)uploadProfileImage(f,"cover");e.currentTarget.value="";}}/></div>
          <div className="editor-avatar-row-v5"><div className="editor-avatar-v5"><img src={profile.avatar_url||"/demo/avatar-v5.svg"} alt=""/><button type="button" onClick={()=>avatarInput.current?.click()} disabled={busy==="avatar"}><ImagePlus size={17}/></button><input ref={avatarInput} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];if(f)uploadProfileImage(f,"avatar");e.currentTarget.value="";}}/></div><div><strong>{profile.display_name}</strong><span>@{profile.username}</span><small>{busy==="avatar"?`Uploading profile photo • ${imageProgress}%`:"JPG, PNG or WebP recommended"}</small>{profile.avatar_url&&<button className="text-danger-v5" type="button" onClick={()=>clearProfileImage("avatar")} disabled={busy==="remove-avatar"}>{busy==="remove-avatar"?"Removing…":"Remove profile photo"}</button>}</div></div>
        </div>
        <form className="profile-form-v5" onSubmit={saveProfile}>
          <div className="two-fields"><label>Display name<input name="display_name" defaultValue={profile.display_name} required/></label><label>Username<input name="username" defaultValue={profile.username} required pattern="[A-Za-z0-9_.]{3,40}"/></label></div>
          <label>Headline<input name="headline" defaultValue={profile.headline||""} maxLength={120} placeholder="Independent companion • Private gallery • Discreet connection"/></label>
          <div className="auto-location-note-v6"><span className="live-dot-v6"/><div><strong>Automatic visitor location</strong><p>The public page detects the current viewer&apos;s approximate city from IP/network data. ES users do not need to set a location manually.</p></div></div>
          <label>About me<textarea name="bio" defaultValue={profile.bio||""} rows={5} maxLength={1000}/></label>
          <div className="profile-details-editor-v14"><div className="details-editor-head-v14"><div><span className="workspace-kicker">PROFILE DETAILS</span><strong>Optional details shown in About Me</strong><small>Use only details you are comfortable showing publicly.</small></div></div><div className="details-editor-grid-v14">
            <label>Age<input name="age" type="number" min="18" max="99" defaultValue={profile.age??""} placeholder="28"/></label>
            <label>Height<input name="height_label" defaultValue={profile.height_label||""} maxLength={40} placeholder={`5'6" / 168 cm`}/></label>
            <label>Body type<select name="body_type" defaultValue={profile.body_type||""}><option value="">Not shown</option><option>Slim</option><option>Petite</option><option>Athletic</option><option>Curvy</option><option>Average</option><option>Full Figure</option><option>Other</option></select></label>
            <label>Ethnicity<input name="ethnicity" defaultValue={profile.ethnicity||""} maxLength={60} placeholder="Optional"/></label>
            <label>Hair<input name="hair_color" defaultValue={profile.hair_color||""} maxLength={60} placeholder="Dark brown, long"/></label>
            <label>Eyes<input name="eye_color" defaultValue={profile.eye_color||""} maxLength={40} placeholder="Brown"/></label>
            <label>Measurements<input name="measurements" defaultValue={profile.measurements||""} maxLength={40} placeholder="34-26-36"/></label>
            <label>Cup size<input name="cup_size" defaultValue={profile.cup_size||""} maxLength={20} placeholder="Optional"/></label>
            <label>Languages<input name="languages" defaultValue={profile.languages||""} maxLength={120} placeholder="English, Spanish"/></label>
            <label>Tattoos / piercings<input name="tattoos_piercings" defaultValue={profile.tattoos_piercings||""} maxLength={120} placeholder="Optional"/></label>
          </div></div>
          <div className="two-fields"><label><span><Phone size={14}/> Direct contact</span><input name="public_phone" defaultValue={profile.public_phone||""} placeholder="+1 (305) 555-0148"/></label><label><span><Mail size={14}/> Private email</span><input name="public_email" type="email" defaultValue={profile.public_email||""} placeholder="hello@example.com"/></label></div>
          <div className="visibility-row-v5"><label className="toggle-row"><input name="phone_visible" type="checkbox" defaultChecked={profile.phone_visible}/><span/>Show direct contact publicly</label><label className="toggle-row"><input name="email_visible" type="checkbox" defaultChecked={profile.email_visible}/><span/>Show private email publicly</label></div>
          <div className="two-fields"><label>Private gallery access price<input name="exclusive_price" type="number" min="0" step="0.01" defaultValue={Number(profile.exclusive_price||0)}/></label><label>Currency<select name="exclusive_currency" defaultValue={profile.exclusive_currency||"USD"}><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option></select></label></div>
          <div className="form-actions-v5"><button className="btn primary" disabled={busy==="save"}>{busy==="save"?<LoaderCircle className="spin-v16" size={17}/>:<Save size={17}/>}<span>{busy==="save"?"Saving & refreshing…":"Save profile"}</span></button><Link className="btn ghost" href={`/u/${profile.username}`}>Preview public page</Link></div>
        </form>
      </section>

      <section className="workspace-panel-v5 profile-share-panel-v14">
        <div className="panel-head-v5"><div><span className="workspace-kicker">SHARE MY PROFILE</span><h2>Your public profile QR</h2><p>Share the link directly or let someone scan the QR code from another phone.</p></div><QrCode/></div>
        <div className="profile-share-layout-v14"><div className="profile-qr-card-v14">{siteOrigin?<img src={`https://quickchart.io/qr?text=${encodeURIComponent(`${siteOrigin}/u/${profile.username}`)}&size=240&margin=2&dark=2b1735&light=ffffff`} alt="Public profile QR code"/>:<div className="qr-skeleton-v14"/>}</div><div className="profile-share-copy-v14"><span>Public profile</span><strong>{siteOrigin ? `${siteOrigin}/u/${profile.username}` : `/u/${profile.username}`}</strong><div><button className="btn secondary" type="button" onClick={async()=>{const url=`${window.location.origin}/u/${profile.username}`;await navigator.clipboard.writeText(url);flash("Profile link copied.");}}><Copy size={15}/> Copy link</button><Link className="btn primary" href={`/u/${profile.username}`}>Open profile</Link></div><small>QR generation uses the public profile URL only; it does not contain account credentials.</small></div></div>
      </section>

      <CreatorPaymentSettings fallbackPhone={profile.public_phone}/>

      <section id="post" className="workspace-panel-v5 post-panel-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">ADD TO MY GALLERY</span><h2>Share something new.</h2><p>Choose a photo or video, preview it, then place it in your public gallery or private collection.</p></div><Upload/></div>
        <form className="post-form-v5 upload-flow-v6" onSubmit={uploadMedia}>
          <div className={`dropzone-v5 upload-preview-v6 ${selectedFile?"has-file":""}`} onClick={()=>mediaInput.current?.click()} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")mediaInput.current?.click();}}>
            {selectedFile&&mediaPreview?<>{selectedFile.type.startsWith("video/")?<video src={mediaPreview} muted playsInline/>:<img src={mediaPreview} alt="Selected media preview"/>}<div className="upload-preview-shade-v6"/><div className="selected-file-badge-v6"><FileImage size={16}/><div><strong>{selectedFile.name}</strong><span>{prettySize(selectedFile.size)} • {selectedFile.type.startsWith("video/")?"Video":"Photo"}</span></div></div><button className="change-file-v6" type="button" onClick={e=>{e.stopPropagation();mediaInput.current?.click();}}><RotateCcw size={14}/> Change</button><button className="clear-file-v6" type="button" onClick={e=>{e.stopPropagation();selectMediaFile(null);if(mediaInput.current)mediaInput.current.value="";}}><X size={14}/></button></>:<><Upload size={27}/><strong>Choose photo or video</strong><span>Click to browse from your computer or phone</span><small>Preview appears here before anything is published.</small></>}
            <input ref={mediaInput} name="file" type="file" accept="image/*,video/*" hidden onChange={e=>selectMediaFile(e.target.files?.[0]||null)}/>
          </div>
          <div className="post-fields-v5"><label>Title<input name="title" maxLength={120} placeholder="Give this post a title"/></label><label>Description<textarea name="description" rows={3} maxLength={500} placeholder="Optional short caption"/></label><label>Visibility<select name="visibility" defaultValue="PUBLIC"><option value="PUBLIC">Public Gallery — anyone can view</option><option value="LOCKED">Private Collection — requires unlock</option></select></label>
            {uploadStage!=="idle"&&<div className={`upload-status-v6 ${uploadStage}`}><div><strong>{uploadStage==="ready"?"Ready to publish":uploadStage==="authorizing"?"Preparing secure upload…":uploadStage==="uploading"?`Uploading • ${uploadProgress}%`:uploadStage==="saving"?"Upload complete • saving post…":"Published successfully"}</strong><span>{uploadStage==="ready"?"Your file is selected. Add details and publish when ready.":uploadStage==="done"?"The new item is already visible in Media Library below.":"Please keep this page open until publishing finishes."}</span></div><div className="upload-progress-track-v6"><span style={{width:`${uploadStage==="ready"?0:uploadStage==="saving"||uploadStage==="done"?100:uploadProgress}%`}}/></div></div>}
            <button className="btn premium-cta publish-v6" disabled={busy==="media"||!selectedFile}><Upload size={17}/>{busy==="media"?(uploadStage==="saving"?"Saving post…":`Uploading ${uploadProgress}%`):"Publish to gallery"}</button>
          </div>
        </form>
      </section>

      <section id="library" className="workspace-panel-v5">
        <div className="panel-head-v5"><div><span className="workspace-kicker">MY GALLERY</span><h2>Your recent content</h2><p>{media.length} total items • {media.filter(m=>m.visibility==="LOCKED").length} private • like counts can be adjusted per item</p></div><Images/></div>
        {media.length===0?<div className="empty-card-v5">Your gallery is empty. Use “Add to My Gallery” above.</div>:<div className="creator-media-library-v5">{media.slice(0,12).map(item=><article key={item.id}><div className="library-thumb-v5">{item.type==="VIDEO"?<video src={item.media_url} muted/>:<img src={item.media_url} alt={item.title||"media"}/>}<span className={`visibility-badge ${item.visibility==="LOCKED"?"locked":""}`}>{item.visibility==="LOCKED"?<><LockKeyhole size={11}/>Private</>:"Public"}</span></div><div className="library-meta-v5 library-meta-v6"><div><strong>{item.title||"Untitled"}</strong>{editingMediaLike===item.id?<div className="inline-like-editor-v6 media"><input aria-label="Media likes" type="number" min="0" max="99999999" value={mediaLikeDraft} onChange={e=>setMediaLikeDraft(e.target.value)}/><button onClick={()=>saveDisplayLikes("media",item.id)} disabled={busy===`media-likes-${item.id}`}><Check size={13}/></button><button onClick={()=>setEditingMediaLike(null)}><X size={13}/></button></div>:<button className="media-like-edit-v6" onClick={()=>{setEditingMediaLike(item.id);setMediaLikeDraft(String(Number(item.likes_count||0)));}}><Heart size={12}/>{item.likes_count||0} likes <Pencil size={11}/></button>}</div><button className="remove-media-v6" onClick={()=>removeMedia(item.id)}>Remove</button></div></article>)}</div>}
      </section>

      <section className="advanced-entry-v5"><div className="advanced-icon"><BarChart3/></div><div><span className="workspace-kicker">PROFILE INSIGHTS</span><h2>Understand your audience.</h2><p>Open deeper visitor signals, repeat visits, device/location patterns, content interest and activity journeys when you need them.</p></div><Link className="btn secondary" href="/dashboard/visitors">Open Profile Insights <ChevronRight size={17}/></Link></section>

      <section id="reviews" className="workspace-panel-v5 creator-review-manager-v7">
        <div className="panel-head-v5"><div><span className="workspace-kicker">CLIENT REVIEWS</span><h2>Build trust with verified reviews.</h2><p>Add feedback you have received. It stays private as Pending until Admin verifies it, then appears on your public profile.</p></div><BadgeCheck/></div>
        <div className="creator-review-summary-v7"><span><strong>{publishedReviews.length}</strong> Verified</span><span><strong>{pendingReviews.length}</strong> Pending</span><span><strong>{rating?rating.toFixed(1):"—"}</strong> Average rating</span></div>
        <div className="creator-review-layout-v7">
          <form className="profile-form-v5 creator-review-form-v7" onSubmit={submitCreatorReview}>
            <div className="two-fields"><label>Reviewer first name<input name="reviewer_first_name" required maxLength={60} placeholder="Jordan"/></label><label>Reviewer last name<input name="reviewer_last_name" required maxLength={60} placeholder="K."/></label></div>
            <label>Reviewer profile image <small>Optional — a default avatar is used if empty</small><input ref={reviewAvatarInput} name="reviewer_avatar" type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(!file){setReviewAvatarPreview("");return;}setReviewAvatarPreview(URL.createObjectURL(file));}}/></label>
            {reviewAvatarPreview&&<div className="review-avatar-preview-v7"><img src={reviewAvatarPreview} alt="Reviewer preview"/><div><strong>Photo ready</strong><span>{busy==="review-create"&&reviewUploadProgress?`Uploading ${reviewUploadProgress}%`:"This image will be attached to the review."}</span></div></div>}
            <label>Rating<select name="rating" defaultValue="5">{[5,4,3,2,1].map(n=><option value={n} key={n}>{"★".repeat(n)} {n} star{n>1?"s":""}</option>)}</select></label>
            <label>Review<textarea name="review_text" required minLength={10} maxLength={1200} rows={5} placeholder="Add the review text you received…"/></label>
            <div className="review-verification-note-v7"><ShieldCheck size={16}/><div><strong>Admin verification required</strong><span>This review will not appear publicly until an Admin verifies it.</span></div></div>
            <button className="btn primary" disabled={busy==="review-create"}>{busy==="review-create"?(reviewUploadProgress?`Uploading ${reviewUploadProgress}%…`:"Submitting…") : "Submit for verification"}</button>
          </form>
          <div className="creator-review-list-v7">
            {reviews.length===0?<div className="empty-card-v5">No client reviews yet. Add the first review using the form.</div>:reviews.slice(0,8).map(r=><article key={r.id}><img src={r.reviewer_avatar_url||"/demo/reviewers/default-reviewer.svg"} alt=""/><div className="creator-review-copy-v7"><div><strong>{r.reviewer_first_name?`${r.reviewer_first_name} ${r.reviewer_last_name||""}`:r.reviewer_name}</strong><span className={`status-chip-v5 ${r.status.toLowerCase()}`}>{r.status==="PUBLISHED"?"VERIFIED":r.status}</span></div><span className="review-stars">{"★".repeat(r.rating)}</span><p>“{r.review_text}”</p><small>{r.status==="PUBLISHED"?"Visible on public profile":r.status==="PENDING"?"Waiting for Admin verification":"Not public"}</small></div></article>)}
          </div>
        </div>
      </section>
    </section>
  </main>;
}
