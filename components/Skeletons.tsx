export function PublicProfileSkeleton(){
  return <main className="public-profile-page skeleton-page-v8" aria-busy="true" aria-label="Loading profile">
    <header className="public-topbar"><div className="skeleton sk-brand"/><div className="skeleton sk-round"/></header>
    <div className="public-profile-shell">
      <section className="profile-hero-v5 skeleton-hero-v8">
        <div className="skeleton sk-cover"/>
        <div className="skeleton-identity-v8"><div className="skeleton sk-avatar"/><div className="sk-copy-stack"><div className="skeleton sk-title"/><div className="skeleton sk-line short"/><div className="skeleton sk-line medium"/><div className="skeleton sk-pill"/></div><div className="sk-action-row"><div className="skeleton sk-button"/><div className="skeleton sk-button"/><div className="skeleton sk-button"/></div></div>
        <div className="skeleton-stat-row-v8">{Array.from({length:5}).map((_,i)=><div className="skeleton sk-stat" key={i}/>)}</div>
      </section>
      <div className="skeleton-tab-row-v8">{Array.from({length:3}).map((_,i)=><div className="skeleton sk-tab" key={i}/>)}</div>
      <section className="profile-section-v5"><div className="skeleton sk-line tiny"/><div className="skeleton sk-heading"/><div className="skeleton-grid-v8"><div className="skeleton sk-media tall"/><div className="skeleton sk-media"/><div className="skeleton sk-media"/></div><div className="skeleton sk-private-panel"/></section>
    </div>
  </main>
}

export function StudioSkeleton({admin=false}:{admin?:boolean}){
  return <main className={`dashboard-page-v5 skeleton-dashboard-v8 ${admin?"admin-v5":""}`} aria-busy="true" aria-label="Loading dashboard">
    <aside className="dashboard-sidebar-v5 skeleton-sidebar-v8"><div className="skeleton sk-brand side"/>{Array.from({length:5}).map((_,i)=><div className="skeleton sk-nav" key={i}/>)}<div className="skeleton sk-user"/></aside>
    <section className="dashboard-content-v5"><header className="workspace-header-v5 skeleton-header-v8"><div><div className="skeleton sk-line tiny"/><div className="skeleton sk-heading wide"/><div className="skeleton sk-line medium"/></div><div className="skeleton sk-button large"/></header>
      <section className="compact-metrics-v5">{Array.from({length:4}).map((_,i)=><article className="metric-v5 skeleton-metric-v8" key={i}><div className="skeleton sk-icon"/><div><div className="skeleton sk-line tiny"/><div className="skeleton sk-number"/><div className="skeleton sk-line short"/></div></article>)}</section>
      <section className="workspace-panel-v5 skeleton-panel-v8"><div className="skeleton sk-line tiny"/><div className="skeleton sk-heading medium"/><div className="skeleton sk-cover-small"/><div className="skeleton-form-v8">{Array.from({length:6}).map((_,i)=><div className="skeleton sk-input" key={i}/>)}</div></section>
    </section>
  </main>
}

export function ListPageSkeleton({admin=true}:{admin?:boolean}){
  return <main className={`dashboard-page-v5 skeleton-dashboard-v8 ${admin?"admin-v5":""}`} aria-busy="true">
    <aside className="dashboard-sidebar-v5 skeleton-sidebar-v8"><div className="skeleton sk-brand side"/>{Array.from({length:5}).map((_,i)=><div className="skeleton sk-nav" key={i}/>)}</aside>
    <section className="dashboard-content-v5"><header className="workspace-header-v5 skeleton-header-v8"><div><div className="skeleton sk-line tiny"/><div className="skeleton sk-heading wide"/><div className="skeleton sk-line medium"/></div></header><section className="workspace-panel-v5 skeleton-panel-v8"><div className="skeleton sk-input search"/>{Array.from({length:6}).map((_,i)=><div className="skeleton-list-row-v8" key={i}><div className="skeleton sk-avatar small"/><div><div className="skeleton sk-line medium"/><div className="skeleton sk-line short"/></div><div className="skeleton sk-pill"/></div>)}</section></section>
  </main>
}

export function VisitorDetailSkeleton(){
  return <main className="visitor-detail-v5 skeleton-page-v8" aria-busy="true"><div className="visitor-detail-shell-v5"><div className="skeleton sk-button"/><section className="visitor-detail-hero-v5 skeleton-detail-hero-v8"><div className="skeleton sk-avatar"/><div><div className="skeleton sk-line tiny"/><div className="skeleton sk-heading medium"/><div className="skeleton sk-line short"/></div></section><section className="detail-metrics-v5">{Array.from({length:5}).map((_,i)=><article key={i}><div className="skeleton sk-icon"/><div className="skeleton sk-number"/><div className="skeleton sk-line short"/></article>)}</section><div className="detail-grid-v5"><section className="workspace-panel-v5 skeleton-panel-v8">{Array.from({length:7}).map((_,i)=><div className="skeleton-list-row-v8" key={i}><div className="skeleton sk-icon"/><div><div className="skeleton sk-line medium"/><div className="skeleton sk-line short"/></div></div>)}</section><aside className="detail-side-v5"><section className="workspace-panel-v5 skeleton-panel-v8"><div className="skeleton sk-heading medium"/>{Array.from({length:4}).map((_,i)=><div className="skeleton sk-input" key={i}/>)}</section></aside></div></div></main>
}
