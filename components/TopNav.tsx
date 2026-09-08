import Link from "next/link";

export function TopNav() {
  return <header className="top-nav shell"><Link href="/" className="brand">CreatorSpace<span>Demo</span></Link><nav><Link href="/u/creator">Creator profile</Link><Link className="btn secondary small" href="/login">Dashboard login</Link></nav></header>;
}
