"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !data.user) {
      setError(authError?.message || "Unable to sign in.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, username")
      .eq("id", data.user.id)
      .single();

    if (profile?.role === "SUPER_ADMIN") router.push("/admin");
    else if (profile?.role === "CREATOR") router.push("/dashboard");
    else router.push("/u/creator");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <Link className="back-link" href="/"><ArrowLeft size={17}/> Back</Link>
        <div className="eyebrow">Secure demo login</div>
        <h1>Welcome back</h1>
        <p className="muted">Use a demo-site account. Do not use an external email provider password.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></label>
          <label>Password<input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></label>
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary wide" disabled={loading}>{loading ? "Signing in…" : <><LogIn size={18}/> Sign in</>}</button>
        </form>
      </div>
    </main>
  );
}
