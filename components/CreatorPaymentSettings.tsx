"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bitcoin, KeyRound, MessageCircle, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Settings = { btc_address: string | null; contact_phone: string | null; instructions: string | null; unlock_code_updated_at: string | null };

export default function CreatorPaymentSettings({ fallbackPhone }: { fallbackPhone?: string | null }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { void load(); }, []);
  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const res = await fetch("/api/creator/payment-settings", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    if (!res.ok) { setSettings({ btc_address: "", contact_phone: fallbackPhone || "", instructions: "", unlock_code_updated_at: null }); return; }
    const body = await res.json(); setSettings(body.settings); setConfigured(Boolean(body.unlock_code_configured));
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(""); setError("");
    const form = new FormData(e.currentTarget);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setError("Please sign in again."); setBusy(false); return; }
    const res = await fetch("/api/creator/payment-settings", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        btc_address: form.get("btc_address"), contact_phone: form.get("contact_phone"), instructions: form.get("instructions"), unlock_code: form.get("unlock_code"),
      }),
    });
    const body = await res.json();
    if (!res.ok) setError(body.error || "Unable to save private-access settings.");
    else { setMessage(body.unlock_code_changed ? "Payment settings saved and unlock code updated." : "Payment settings saved."); if (body.unlock_code_changed) setConfigured(true); await load(); (e.currentTarget.elements.namedItem("unlock_code") as HTMLInputElement | null)?.setAttribute("value", ""); }
    setBusy(false);
  }

  if (!settings) return <section className="workspace-panel-v5 payment-settings-v9"><div className="payment-settings-skeleton-v9"/></section>;
  return <section id="private-access" className="workspace-panel-v5 payment-settings-v9">
    <div className="panel-head-v5"><div><span className="workspace-kicker">PAYMENT & PRIVATE ACCESS</span><h2>Control how guests unlock your private gallery.</h2><p>Accept Bitcoin or arrange payment directly. After you confirm payment, share your private unlock code with the visitor.</p></div><Bitcoin/></div>
    {message && <div className="success-banner">{message}</div>}{error && <div className="error-banner">{error}</div>}
    <form className="profile-form-v5" onSubmit={save}>
      <label><span><Bitcoin size={14}/> Bitcoin receiving address</span><input name="btc_address" defaultValue={settings.btc_address || ""} placeholder="bc1q…" autoComplete="off"/><small>Visitors can copy this address or open it in their Bitcoin wallet. Never enter a seed phrase or private key here.</small></label>
      <label><span><MessageCircle size={14}/> Payment contact number</span><input name="contact_phone" defaultValue={settings.contact_phone || fallbackPhone || ""} placeholder="+1 …"/><small>Shown only in the private-access flow so visitors can text you after payment or arrange another payment method.</small></label>
      <label>Payment instructions<textarea name="instructions" rows={3} defaultValue={settings.instructions || "Send payment, then text me with your payment reference. I’ll confirm it and send your private-gallery unlock code."}/></label>
      <label><span><KeyRound size={14}/> {configured ? "Replace unlock code" : "Create unlock code"}</span><input name="unlock_code" type="password" minLength={6} maxLength={64} placeholder={configured ? "Leave blank to keep the current code" : "Minimum 6 characters"} autoComplete="new-password"/><small>The code is hashed on the server and is never returned to the browser. Share it only after you confirm payment.</small></label>
      <div className="review-verification-note-v7"><ShieldCheck size={16}/><div><strong>{configured ? "Unlock code configured" : "Unlock code required"}</strong><span>Current V9 access is temporary for the browser. Account-based 30-day access can be added in the next phase.</span></div></div>
      <button className="btn primary" disabled={busy}><Save size={16}/>{busy ? "Saving…" : "Save private-access settings"}</button>
    </form>
  </section>;
}
