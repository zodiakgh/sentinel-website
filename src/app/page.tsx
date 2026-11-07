import Link from "next/link";
import { Activity, ArrowRight, BarChart3, Check, ChevronRight, Globe2, MousePointer2, ShieldCheck, Zap } from "lucide-react";

const metrics = [
  { label: "Unique visitors", value: "24,891", change: "+18.6%", bars: [24, 38, 32, 55, 43, 70, 62, 82, 68, 94, 76, 100] },
  { label: "Page views", value: "86,204", change: "+12.3%", bars: [30, 42, 38, 61, 49, 76, 65, 83, 72, 91, 80, 100] },
];

const features = [
  { icon: Activity, title: "Live traffic (planned)", text: "See who's on your website right now and understand how visits turn into engagement." },
  { icon: BarChart3, title: "Clear reporting (planned)", text: "Pages, sources, campaigns, devices and locations in one focused workspace." },
  { icon: ShieldCheck, title: "Privacy by design (planned)", text: "Built around data minimisation, consent controls and transparent measurement." },
  { icon: Zap, title: "Lightweight tracking (planned)", text: "A small tracking script designed to collect useful signals without slowing your site." },
];

export default function Home() {
  return (
    <main>
      <header className="topbar wrap">
        <Link href="/" className="brand"><span className="brand-mark"><Activity size={17}/></span><span>SENTINEL<span className="brand-muted"> ANALYTICS</span></span></Link>
        <nav className="nav-links"><a href="#product">Product</a><a href="#features">Features</a><a href="#privacy">Privacy</a></nav>
        <div className="nav-actions"><Link className="text-link" href="/login">Sign in</Link><Link className="button button-small" href="/signup">Create account <ArrowRight size={15}/></Link></div>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot"/> WEBSITE ANALYTICS · EARLY ACCESS</div>
          <h1>Know your traffic.<br/><span>Make better moves.</span></h1>
          <p className="hero-lede">The essential picture of your website, without the noise. Understand your audience, measure what matters and move with confidence.</p>
          <div className="hero-actions"><Link className="button" href="/signup">Create your account <ArrowRight size={16}/></Link><a className="button button-quiet" href="#product">Explore the platform <ChevronRight size={16}/></a></div>
          <div className="hero-note"><ShieldCheck size={15}/> Accounts are open · Live website tracking is coming later.</div>
        </div>
        <div className="preview-shell" id="product">
          <div className="preview-window">
            <div className="preview-top"><div className="window-dots"><i/><i/><i/></div><span>OVERVIEW / LAST 30 DAYS</span><span className="live-label"><b/> SAMPLE DATA</span></div>
            <div className="preview-body">
              <div className="preview-heading"><div><small>MONDAY, NOVEMBER 2 — SUNDAY, NOVEMBER 29</small><h3>Good morning.</h3></div><span className="period-chip">Last 30 days⌄</span></div>
              <div className="metric-grid">{metrics.map((m) => <div className="metric-card" key={m.label}><span>{m.label}</span><strong>{m.value}</strong><em>{m.change} <small>vs. previous period</small></em><div className="spark-bars">{m.bars.map((h,i)=><i key={i} style={{height:h+"%"}}/>)}</div></div>)}</div>
              <div className="chart-card"><div className="chart-head"><div><span>VISITOR ACTIVITY</span><strong>Visitors over time</strong></div><span className="chart-legend"><i/> Visitors</span></div><div className="chart-visual"><div className="chart-y"><span>3k</span><span>2k</span><span>1k</span><span>0</span></div><svg viewBox="0 0 560 130" preserveAspectRatio="none" aria-label="Illustrative visitor activity chart"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#b8c1cb" stopOpacity=".22"/><stop offset="1" stopColor="#b8c1cb" stopOpacity="0"/></linearGradient></defs><path d="M0 105 C28 94 36 98 58 82 S92 89 116 75 S145 81 168 61 S202 73 225 54 S253 69 280 48 S313 62 336 42 S365 55 392 35 S426 50 448 26 S485 41 510 18 S540 30 560 8 L560 130 L0 130Z" fill="url(#area)"/><path d="M0 105 C28 94 36 98 58 82 S92 89 116 75 S145 81 168 61 S202 73 225 54 S253 69 280 48 S313 62 336 42 S365 55 392 35 S426 50 448 26 S485 41 510 18 S540 30 560 8" fill="none" stroke="#d5dbe2" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg></div><div className="chart-x"><span>Nov 02</span><span>Nov 09</span><span>Nov 16</span><span>Nov 23</span><span>Nov 29</span></div></div>
              <div className="preview-foot"><span><i/> All systems operational</span><span>Illustrative dashboard preview</span></div>
            </div>
          </div>
          <div className="float-tag"><span><MousePointer2 size={14}/></span><div><b>Every visit tells a story</b><small>From first click to conversion</small></div></div>
        </div>
      </section>

      <section className="trust-strip"><div className="wrap trust-inner"><span>BUILT FOR PEOPLE WHO BUILD THE WEB</span><div><span>PRODUCT TEAMS</span><span>INDEPENDENT BUILDERS</span><span>GROWING BUSINESSES</span></div></div></section>

      <section className="section wrap" id="features">
        <div className="section-intro"><div className="eyebrow">PLANNED PRODUCT CAPABILITIES</div><h2>Everything you need.<br/><span>Nothing you don't.</span></h2><p>These capabilities describe the product direction. The workspace and account system are available now. Live tracking, visitor reports and event collection are still in development.</p></div>
        <div className="feature-grid">{features.map(({icon:Icon,title,text},i)=><article className="feature-card" key={title}><div className="feature-icon"><Icon size={19}/></div><small>0{i+1}</small><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="privacy-band" id="privacy"><div className="wrap privacy-inner"><div><div className="eyebrow">YOUR DATA DESERVES RESPECT</div><h2>Useful insights.<br/>Thoughtful by default.</h2><p>Analytics should help you understand your audience, not collect everything about them. Sentinel is being built with clear controls, limited collection and privacy-conscious defaults.</p><Link className="text-link" href="/privacy">Our privacy principles <ArrowRight size={15}/></Link></div><div className="privacy-points"><div><ShieldCheck/><span><b>Privacy-first foundations</b><small>Designed for data minimisation and consent-aware measurement.</small></span><Check/></div><div><Globe2/><span><b>Built for the open web</b><small>One workspace for the websites you manage.</small></span><Check/></div><div><Activity/><span><b>Metrics you can act on</b><small>Understand performance without drowning in dashboards.</small></span><Check/></div></div></div></section>

      <section className="closing wrap"><div><div className="eyebrow">A CLEARER VIEW STARTS HERE</div><h2>Your website has a story.<br/><span>Start reading it.</span></h2><p>Create your account and explore the workspace while live tracking is in development.</p><Link className="button" href="/dashboard">Explore the preview <ArrowRight size={16}/></Link></div></section>
      <footer className="footer wrap"><Link href="/" className="brand"><span className="brand-mark"><Activity size={16}/></span><span>SENTINEL<span className="brand-muted"> ANALYTICS</span></span></Link><span>© 2026 Sentinel Analytics · Early access</span><div><Link href="/mentions-legales">Legal notice</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></footer>
    </main>
  );
}
