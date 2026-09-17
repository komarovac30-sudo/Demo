"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bitcoin, Check, Clipboard, KeyRound, MessageCircle, Phone, ShieldCheck, X } from "lucide-react";

type Props = {
  creatorId: string; displayName: string; priceLabel: string; btcAddress?: string | null; contactPhone?: string | null; instructions?: string | null;
  onClose: () => void; onUnlocked: () => Promise<void> | void;
};
type Step = "choose" | "btc" | "contact";

export default function PrivateAccessModal(props: Props) {
  const [step, setStep] = useState<Step>("choose"); const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [copied, setCopied] = useState("");
  const smsHref = useMemo(() => props.contactPhone ? `sms:${props.contactPhone.replace(/[^+\d]/g, "")}?body=${encodeURIComponent(`Hi ${props.displayName}, I would like to arrange access to your private gallery.`)}` : "", [props.contactPhone, props.displayName]);
  async function copy(text: string, type: string) { try { await navigator.clipboard.writeText(text); setCopied(type); window.setTimeout(() => setCopied(""), 1600); } catch {} }
  async function verify(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await fetch("/api/exclusive/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creator_id: props.creatorId, code }) });
      const body = await res.json(); if (!res.ok) throw new Error(body.error || "Unable to verify code.");
      await props.onUnlocked();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to verify code."); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={props.onClose}><section className="gate-modal payment-flow-v9" onMouseDown={e => e.stopPropagation()}>
    <button className="modal-close" onClick={props.onClose}><X/></button>
    {step === "choose" && <><span className="section-kicker">PRIVATE GALLERY</span><h2>Choose how you’d like to unlock</h2><p>Private digital-gallery access is {props.priceLabel}. Complete payment directly, then use the code provided by {props.displayName}.</p><div className="payment-methods-v9">
      <button disabled={!props.btcAddress} onClick={() => setStep("btc")}><Bitcoin/><div><strong>Pay with Bitcoin</strong><span>{props.btcAddress ? "Send BTC directly to the profile owner" : "Bitcoin address not configured yet"}</span></div></button>
      <button onClick={() => setStep("contact")}><MessageCircle/><div><strong>Arrange Payment</strong><span>Text {props.displayName} for another payment option</span></div></button>
    </div><div className="payment-trust-v9"><ShieldCheck/><span>No card or payment credentials are stored by Veloura.</span></div></>}

    {step === "btc" && <><span className="section-kicker">BITCOIN PAYMENT</span><h2>Pay {props.priceLabel} in BTC</h2><p>Send the BTC equivalent agreed with {props.displayName}. After sending, message the payment reference/transaction ID to receive your unlock code.</p><div className="btc-address-v9"><span>Bitcoin address</span><code>{props.btcAddress}</code><div><button onClick={() => props.btcAddress && copy(props.btcAddress, "btc")}><Clipboard size={15}/>{copied === "btc" ? "Copied" : "Copy address"}</button>{props.btcAddress && <a href={`bitcoin:${props.btcAddress}`}><Bitcoin size={15}/>Open wallet</a>}</div></div>{props.instructions && <div className="payment-instructions-v9">{props.instructions}</div>}<div className="payment-actions-v9"><button className="btn ghost" onClick={() => setStep("choose")}>Back</button><button className="btn premium-cta" onClick={() => setStep("contact")}>I’ve sent the BTC</button></div></>}

    {step === "contact" && <><span className="section-kicker">CONFIRM & UNLOCK</span><h2>Message {props.displayName}</h2><p>{props.instructions || "Confirm your payment directly with the profile owner. Once it is confirmed, you’ll receive a private unlock code."}</p>{props.contactPhone ? <div className="contact-payment-v9"><Phone/><div><span>Payment contact</span><strong>{props.contactPhone}</strong></div><div><a href={smsHref}><MessageCircle size={15}/>Text</a><button onClick={() => copy(props.contactPhone || "", "phone")}><Clipboard size={15}/>{copied === "phone" ? "Copied" : "Copy"}</button></div></div> : <div className="error-banner">A payment contact number has not been configured yet.</div>}
      <form className="unlock-code-form-v9" onSubmit={verify}><div><KeyRound/><div><strong>Already have your unlock code?</strong><span>Enter the code sent by {props.displayName}.</span></div></div><input value={code} onChange={e => setCode(e.target.value)} minLength={4} maxLength={64} placeholder="Enter unlock code" autoComplete="one-time-code" required/>{error && <div className="error-banner">{error}</div>}<button className="btn premium-cta wide" disabled={busy || !code.trim()}>{busy ? "Checking code…" : <><Check size={17}/>Unlock Private Gallery</>}</button></form><button className="text-button-v9" onClick={() => setStep("choose")}>Choose a different payment method</button></>}
  </section></div>;
}
