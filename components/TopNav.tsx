import Link from "next/link";

export default function TopNav() {
  return <header className="top-nav shell"><Link href="/" className="brand">VELOURA<span>Demo</span></Link><nav><Link href="/u/creator">Public profile</Link><Link className="btn secondary small" href="/login">Private workspace</Link></nav></header>;
}
