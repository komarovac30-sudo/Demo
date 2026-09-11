"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck, ChevronLeft, ImagePlus, LogOut, Search, ShieldCheck, Star, Trash2, UserRound, XCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { ListPageSkeleton } from "@/components/Skeletons";

type Creator = { id:string; display_name:string; username:string };
type Review = {
  id:string; creator_id:string; reviewer_name:string; reviewer_first_name:string|null; reviewer_last_name:string|null;
  reviewer_avatar_url:string|null; rating:number; review_text:string; is_published:boolean;
  status:"PENDING"|"PUBLISHED"|"REJECTED"; source:"VISITOR"|"ADMIN"|"CREATOR"; created_at:string;
  profiles?:{display_name?:string;username?:string}|null;
};

function sourceLabel(source: Review["source"]) {
  if (source === "CREATOR") return "Creator submitted";
  if (source === "VISITOR") return "Visitor submitted";
  return "Admin added";
}

export default function AdminReviews(){
  const [ready,setReady]=useState(false);
  const [authorized,setAuthorized]=useState(false);
  const [creators,setCreators]=useState<Creator[]>([]);
  const [reviews,setReviews]=useState<Review[]>([]);
  const [q,setQ]=useState("");
  const [status,setStatus]=useState("ALL");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const [avatarPreview,setAvatarPreview]=useState("");
  const avatarInput=useRef<HTMLInputElement>(null);

  const flash=(text:string,isError=false)=>{
    if(isError){setError(text);setMessage("");}else{setMessage(text);setError("");}
    window.setTimeout(()=>{setMessage("");setError("");},5000);
  };

  const load=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setReady(true);return;}
    const {data:me}=await supabase.from("profiles").select("role").eq("id",user.id).single();
    if(me?.role!=="SUPER_ADMIN"){setReady(true);return;}
    setAuthorized(true);

    const [{data:c},{data:{session}}]=await Promise.all([
      supabase.from("profiles").select("id,display_name,username").eq("role","CREATOR").order("display_name"),
      supabase.auth.getSession(),
    ]);
    setCreators((c||[]) as Creator[]);

    if(session?.access_token){
      const res=await fetch("/api/admin/reviews",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
      const body=await res.json();
      if(res.ok)setReviews((body.reviews||[]) as Review[]);
      else setError(body.error||"Unable to load reviews.");
    }
    setReady(true);
  },[]);

  useEffect(()=>{load();},[load]);

  const filtered=useMemo(()=>reviews.filter(r=>(status==="ALL"||r.status===status)&&[
    r.reviewer_name,r.review_text,r.profiles?.display_name,r.profiles?.username,sourceLabel(r.source)
  ].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())),[reviews,q,status]);

  async function addReview(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const formEl=e.currentTarget;
    const form=new FormData(formEl);
    setBusy("create");setError("");setMessage("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error("Sign in again.");
      let avatarUrl:null|string=null;
      const file=form.get("reviewer_avatar") as File;
      if(file?.size)avatarUrl=(await uploadToCloudinary(file,session.access_token,"review-avatar")).secure_url;

      const res=await fetch("/api/reviews",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({
          creator_id:form.get("creator_id"),
          reviewer_first_name:form.get("reviewer_first_name"),
          reviewer_last_name:form.get("reviewer_last_name"),
          rating:Number(form.get("rating")),
          review_text:form.get("review_text"),
          reviewer_avatar_url:avatarUrl,
          publish:form.get("publish")==="on",
        }),
      });
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||"Unable to add review.");

      formEl.reset();
      if(avatarInput.current)avatarInput.current.value="";
      setAvatarPreview("");
      flash(body.review?.status==="PUBLISHED"?"Review verified and published successfully.":"Review saved as pending.");
      await load();
    }catch(err){flash(err instanceof Error?err.message:"Unable to add review.",true);}
    finally{setBusy("");}
  }

  async function updateReview(id:string,nextStatus:"PENDING"|"PUBLISHED"|"REJECTED"){
    setBusy(id);setError("");setMessage("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error("Your admin session expired. Please sign in again.");
      const res=await fetch(`/api/admin/reviews/${id}`,{
        method:"PATCH",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({status:nextStatus}),
      });
      const body=await res.json();
      if(!res.ok)throw new Error(body.error||"Unable to update review.");
      flash(nextStatus==="PUBLISHED"?"Review verified and published.":nextStatus==="PENDING"?"Review moved back to pending.":"Review rejected and hidden.");
      await load();
    }catch(err){flash(err instanceof Error?err.message:"Unable to update review.",true);}
    finally{setBusy("");}
  }

  async function removeReview(id:string){
    if(!confirm("Delete this review permanently?"))return;
    setBusy(id);setError("");
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)throw new Error("Your admin session expired. Please sign in again.");
      const res=await fetch(`/api/admin/reviews/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${session.access_token}`}});
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(body.error||"Unable to delete review.");
      flash("Review deleted.");await load();
    }catch(err){flash(err instanceof Error?err.message:"Unable to delete review.",true);}
    finally{setBusy("");}
  }

  async function logout(){await supabase.auth.signOut();location.href="/login";}

  if(!ready)return <ListPageSkeleton/>;
  if(!authorized)return <div className="center-screen"><Link className="btn primary" href="/login">Admin login</Link></div>;

  const pendingCount=reviews.filter(r=>r.status==="PENDING").length;
  const publishedCount=reviews.filter(r=>r.status==="PUBLISHED").length;

  return <main className="dashboard-page-v5 admin-v5">
    <aside className="dashboard-sidebar-v5">
      <Link href="/" className="veloura-brand"><span>V</span>VELOURA</Link><div className="workspace-label">Admin</div>
      <nav><Link href="/admin">Home</Link><Link href="/admin/creators">ES profiles</Link><Link className="active" href="/admin/reviews">Reviews</Link><Link href="/admin/visitors">Visitors</Link><Link href="/admin/visitors">Advanced analytics</Link></nav>
      <button className="sidebar-logout" onClick={logout}><LogOut size={17}/> Log out</button>
    </aside>

    <section className="dashboard-content-v5">
      <header className="workspace-header-v5"><div><Link className="back-link-v5" href="/admin"><ChevronLeft size={15}/> Admin home</Link><span className="workspace-kicker"><Star size={14}/> REVIEW MANAGEMENT</span><h1>Verify reviews.</h1><p>Creator and Visitor submissions stay hidden until you verify them. Published reviews automatically show as “Verified review” on the public profile.</p></div></header>
      {message&&<div className="alert success">{message}</div>}{error&&<div className="alert error">{error}</div>}

      <section className="review-admin-summary-v7">
        <article><span>Pending verification</span><strong>{pendingCount}</strong><small>Needs Admin action</small></article>
        <article><span>Verified reviews</span><strong>{publishedCount}</strong><small>Visible publicly</small></article>
        <article><span>Total reviews</span><strong>{reviews.length}</strong><small>All sources</small></article>
      </section>

      <section className="admin-home-grid-v5 reviews-admin-grid-v5">
        <div className="workspace-panel-v5 admin-add-review-v7">
          <div className="panel-head-v5"><div><span className="workspace-kicker">ADMIN REVIEW</span><h2>Add a review manually</h2><p>Optional admin tool. Creator-submitted reviews can simply be verified from the moderation list.</p></div><ImagePlus/></div>
          <form className="profile-form-v5" onSubmit={addReview}>
            <label>ES profile<select name="creator_id" required defaultValue=""><option value="" disabled>Select ES</option>{creators.map(c=><option key={c.id} value={c.id}>{c.display_name} (@{c.username})</option>)}</select></label>
            <div className="two-fields"><label>First name<input name="reviewer_first_name" required placeholder="Daniel"/></label><label>Last name<input name="reviewer_last_name" required placeholder="R."/></label></div>
            <label>Reviewer profile image <small>Optional — default avatar is used if empty</small><input ref={avatarInput} name="reviewer_avatar" type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(!file){setAvatarPreview("");return;}setAvatarPreview(URL.createObjectURL(file));}}/></label>
            {avatarPreview&&<div className="review-avatar-preview-v7"><img src={avatarPreview} alt="Reviewer preview"/><span>Reviewer image preview</span></div>}
            <label>Rating<select name="rating" defaultValue="5">{[5,4,3,2,1].map(n=><option key={n} value={n}>{"★".repeat(n)} {n} stars</option>)}</select></label>
            <label>Review<textarea name="review_text" minLength={10} maxLength={1200} rows={5} required placeholder="Add the review text…"/></label>
            <label className="check-row-v5"><input type="checkbox" name="publish"/> Verify & publish immediately</label>
            <button className="btn primary" disabled={busy==="create"}>{busy==="create"?"Saving…":"Save review"}</button>
          </form>
        </div>

        <div className="workspace-panel-v5 moderation-panel-v5">
          <div className="panel-head-v5"><div><span className="workspace-kicker">MODERATION</span><h2>{pendingCount} waiting for verification</h2><p>Use Verify to publish a review. Pending and rejected reviews remain hidden from visitors.</p></div><BadgeCheck/></div>
          <div className="review-filterbar-v5"><div className="admin-search-v5"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search reviewer, ES or text…"/></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All status</option><option value="PENDING">Pending</option><option value="PUBLISHED">Verified</option><option value="REJECTED">Rejected</option></select></div>
          <div className="moderation-list-v5 moderation-list-v7">
            {filtered.map(r=><article key={r.id}>
              <img src={r.reviewer_avatar_url||"/demo/reviewers/default-reviewer.svg"} alt=""/>
              <div className="moderation-copy-v5"><div><strong>{r.reviewer_first_name?`${r.reviewer_first_name} ${r.reviewer_last_name||""}`:r.reviewer_name}</strong><span className={`source-chip-v5 ${r.source.toLowerCase()}`}>{sourceLabel(r.source)}</span><span className={`status-chip-v5 ${r.status.toLowerCase()}`}>{r.status==="PUBLISHED"?"VERIFIED":r.status}</span></div><span className="review-stars">{"★".repeat(r.rating)}</span><p>“{r.review_text}”</p><small>{r.profiles?.display_name||"ES"} • {new Date(r.created_at).toLocaleDateString()}</small></div>
              <div className="moderation-actions-v5 moderation-actions-v7">
                {r.status!=="PUBLISHED"&&<button className="verify-action-v7" title="Verify and publish" onClick={()=>updateReview(r.id,"PUBLISHED")} disabled={busy===r.id}><ShieldCheck/><span>{busy===r.id?"Working…":"Verify"}</span></button>}
                {r.status!=="PENDING"&&<button title="Move to pending" onClick={()=>updateReview(r.id,"PENDING")} disabled={busy===r.id}><UserRound/><span>Pending</span></button>}
                {r.status!=="REJECTED"&&<button title="Reject" onClick={()=>updateReview(r.id,"REJECTED")} disabled={busy===r.id}><XCircle/><span>Reject</span></button>}
                <button className="danger-action-v7" title="Delete" onClick={()=>removeReview(r.id)} disabled={busy===r.id}><Trash2/><span>Delete</span></button>
              </div>
            </article>)}
            {filtered.length===0&&<div className="empty-card-v5">No reviews match this filter.</div>}
          </div>
        </div>
      </section>
    </section>
  </main>;
}
