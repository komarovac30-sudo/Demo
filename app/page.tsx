import Link from "next/link";
import { ArrowRight, BarChart3, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { TopNav } from "@/components/TopNav";

export default function HomePage() {
  return (
    <main>
      <TopNav />
      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={16} /> Client preview environment</div>
          <h1>A polished creator profile demo with controlled content access.</h1>
          <p>
            Super Admin creates profile owners, creators publish media, visitors browse public content and unlock restricted posts with a demo account.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" href="/u/creator">View creator profile <ArrowRight size={18} /></Link>
            <Link className="btn secondary" href="/login">Open dashboard</Link>
          </div>
        </div>
        <div className="hero-card glass-card">
          <div className="hero-card-top">
            <div>
              <span className="muted">Demo creator</span>
              <h3>@creator</h3>
            </div>
            <span className="pill success">Active</span>
          </div>
          <div className="mini-cover" />
          <div className="mini-grid">
            <div className="mini-stat"><strong>1.8K</strong><span>Views</span></div>
            <div className="mini-stat"><strong>312</strong><span>Unlocks</span></div>
            <div className="mini-stat"><strong>4.9</strong><span>Rating</span></div>
          </div>
        </div>
      </section>

      <section className="shell feature-grid">
        <article className="feature-card"><ShieldCheck /><h3>Role based</h3><p>Separate Super Admin, Creator and Visitor experiences.</p></article>
        <article className="feature-card"><LockKeyhole /><h3>Public + locked media</h3><p>Visitors see previews and unlock a creator profile with a demo-site account.</p></article>
        <article className="feature-card"><BarChart3 /><h3>Trackable events</h3><p>Profile views, locked-content views, unlock attempts and successful access are recorded.</p></article>
      </section>
    </main>
  );
}
