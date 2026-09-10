"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BadgeCheck, ChevronRight, Eye, LogOut, MessageSquareText, ShieldCheck, Star, Unlock, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Creator = { id:string; display_name:string; username:string; avatar_url?:string|null; headline?:string|null; is_active:boolean; is_verified?:boolean };
type Analytics = { totals:{ unique_visitors:number; profile_views:number; media_views:number; unlocks:number; likes:number; active_today:number } };

export default function AdminHome(){
  const[ready,setReady]=useState(false);const[authorized,setAuthorized]=useState(false);const[creators,setCreators]=useState<Creator[]>([]);
  const[visitorAccounts,setVisitorAccounts]=useState(0);const[pendingReviews,setPendingReviews]=useState(0);const[analytics,setAnalytics]=useState<Analytics|null>(null);const[unlockCount,setUnlockCount]=useState(0);
  const load=useCallback(async()=>{
    const{data:{user}}=await supabase.auth.getUser();if(!user){setReady(true);return;}
    const{data:me}=await supabase.from("profiles").select("role").eq("id",user.id).single();if(me?.role!=="SUPER_ADMIN"){setReady(true);return;}setAuthorized(true);
    const[{data:creatorRows},{count:visitorCount},{count:reviewCount},{count:payCount},{data:{session}}]=await Promise.all([
      supabase.from("profiles").select("id,display_name,username,avatar_url,headline,is_active,is_verified").eq("role","CREATOR").order("created_at",{ascending:false}),
      supabase.from("profiles").select("id",{count:"exact",head:true}).eq("role","VISITOR"),
      supabase.from("reviews").select("id",{count:"exact",head:true}).eq("status","PENDING"),
      supabase.from("payments").select("id",{count:"exact",head:true}).eq("status","CONFIRMED"),
      supabase.auth.getSession(),
    ]);
    setCreators((creatorRows||[]) as Creator[]);setVisitorAccounts(visitorCount||0);setPendingReviews(reviewCount||0);setUnlockCount(payCount||0);
    if(session?.access_token){const res=await fetch("/api/analytics/visitors",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});if(res.ok)setAnalytics(await res.json() as Analytics);}
    setReady(true);
  },[]);useEffect(()=>{load();},[load]);
  async function logout(){await supabase.auth.signOut();location.href="/login";}
  if(!ready)return <div className="center-screen"><span className="loader-orb"/><p>Opening command center…</p></div>;
  if(!authorized)return <div className="center-screen"><div className="friendly-error"><h2>Admin access required</h2><Link className="btn primary" href="/login">Go to login</Link></div></div>;
  const activeEs=creators.filter(c=>c.is_active).length;
  return <main className="dashboard-page-v5 admin-v5">
    <aside className="dashboard-sidebar-v5"><Link href="/" className="veloura-brand"><span>V</span>VELOURA</Link><div className="workspace-label">Admin</div><nav><Link className="active" href="/admin">Home</Link><Link href="/admin/creators">ES profiles</Link><Link href="/admin/reviews">Reviews</Link><Link href="/admin/visitors">Visitors</Link><Link href="/admin/visitors">Advanced analytics</Link></nav><div className="sidebar-system-v5"><span className="status-dot-v5"/>Platform online</div><button className="sidebar-logout" onClick={logout}><LogOut size={17}/> Log out</button></aside>
    <section className="dashboard-content-v5">
      <header className="workspace-header-v5"><div><span className="workspace-kicker"><ShieldCheck size={14}/> ADMIN COMMAND CENTER</span><h1>Platform overview</h1><p>A clean snapshot of the two user groups and the work that needs attention.</p></div><Link className="btn secondary" href="/u/creator">Open public demo <Eye size={17}/></Link></header>

      <section className="admin-primary-counts-v5">
        <article className="admin-count-card-v5 es"><div className="count-icon-v5"><BadgeCheck/></div><div><span>USER TYPE B</span><h2>{creators.length}</h2><strong>Total ES profiles</strong><p>{activeEs} active • {creators.length-activeEs} disabled</p></div><Link href="/admin/creators">Manage ES <ChevronRight size={16}/></Link></article>
        <article className="admin-count-card-v5 visitors"><div className="count-icon-v5"><Users/></div><div><span>USER TYPE 3</span><h2>{visitorAccounts}</h2><strong>Total Visitor accounts</strong><p>{analytics?.totals.unique_visitors||0} unique profile visitors tracked</p></div><Link href="/admin/visitors">Visitor Intelligence <ChevronRight size={16}/></Link></article>
      </section>

      <section className="admin-secondary-metrics-v5">
        <article><Activity/><div><span>Unique profile visitors</span><strong>{analytics?.totals.unique_visitors??0}</strong></div></article>
        <article><Eye/><div><span>Profile views</span><strong>{analytics?.totals.profile_views??0}</strong></div></article>
        <article><MessageSquareText/><div><span>Pending reviews</span><strong>{pendingReviews}</strong></div></article>
        <article><Unlock/><div><span>Demo unlocks</span><strong>{unlockCount||analytics?.totals.unlocks||0}</strong></div></article>
      </section>

      <section className="admin-home-grid-v5">
        <div className="workspace-panel-v5 quick-actions-panel-v5"><div className="panel-head-v5"><div><span className="workspace-kicker">QUICK ACTIONS</span><h2>What do you want to manage?</h2></div></div><div className="quick-action-grid-v5">
          <Link href="/admin/creators"><UserPlus/><div><strong>Create / manage ES</strong><span>Add accounts, verify profiles and control active status.</span></div><ChevronRight/></Link>
          <Link href="/admin/reviews"><Star/><div><strong>Manage reviews</strong><span>Add reviews and moderate visitor submissions.</span></div><ChevronRight/></Link>
          <Link href="/admin/visitors"><Users/><div><strong>Visitor Intelligence</strong><span>One consolidated row per captured visitor/IP.</span></div><ChevronRight/></Link>
          <Link href="/admin/visitors"><Activity/><div><strong>Advanced analytics</strong><span>Sessions, content interest and detailed activity journey.</span></div><ChevronRight/></Link>
        </div></div>

        <div className="workspace-panel-v5"><div className="panel-head-v5"><div><span className="workspace-kicker">RECENT ES</span><h2>Latest profiles</h2></div><Link href="/admin/creators" className="text-link-v5">View all <ChevronRight size={15}/></Link></div><div className="recent-es-list-v5">{creators.slice(0,5).map(c=><article key={c.id}><img src={c.avatar_url||"/demo/avatar-v5.svg"} alt=""/><div><strong>{c.display_name}</strong><span>@{c.username}</span></div><span className={`status-chip-v5 ${c.is_active?"active":"disabled"}`}>{c.is_active?"Active":"Disabled"}</span><Link href={`/u/${c.username}`} aria-label="Open profile"><ChevronRight/></Link></article>)}</div></div>
      </section>
    </section>
  </main>;
}
