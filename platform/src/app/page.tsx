import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Globe2,
  MousePointer2,
  ShieldCheck,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Live visitor activity",
    description:
      "See active visitors, the pages they view and where sessions begin in near real time.",
  },
  {
    icon: BarChart3,
    title: "Understand every visit",
    description:
      "Explore traffic trends, acquisition channels, popular pages and engagement over time.",
  },
  {
    icon: MousePointer2,
    title: "Track what matters",
    description:
      "Measure custom events, goals and conversions with a lightweight tracking script.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy-conscious by design",
    description:
      "Build useful aggregate insights without turning your analytics into invasive surveillance.",
  },
  {
    icon: Globe2,
    title: "All your websites, one place",
    description:
      "Manage multiple projects from one workspace and keep each site's data separated.",
  },
  {
    icon: Zap,
    title: "Fast, clear reports",
    description:
      "Get the information you need without a complicated analytics interface.",
  },
];

const sampleBars = [32, 48, 39, 58, 44, 68, 53, 77, 61, 86, 70, 94, 74, 82, 63, 91, 72, 100, 79, 88, 67, 95, 76, 84];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Sentinel Analytics home">
          <span className="brand-mark"><Activity size={17} strokeWidth={2.4} /></span>
          <span>SENTINEL<span className="brand-muted"> ANALYTICS</span></span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="header-actions">
          <Link className="text-link" href="/login">Sign in</Link>
          <Link className="button button-small" href="/signup">
            Get started <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <section className="hero section-shell">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> WEBSITE INTELLIGENCE, MADE CLEAR</div>
          <h1>Know what’s happening on <span>your website.</span></h1>
          <p className="hero-description">
            Understand your traffic, discover what works and follow every important
            interaction. All your website analytics, in one calm and focused workspace.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/signup">Create your free account <ArrowRight size={16} /></Link>
            <a className="button button-ghost" href="#features">Explore features <ChevronRight size={16} /></a>
          </div>
          <div className="hero-proof">
            <span><Check size={14} /> Free to get started</span>
            <span><Check size={14} /> Multiple websites</span>
            <span><Check size={14} /> No credit card required</span>
          </div>
        </div>

        <div className="preview-wrap" aria-label="Illustrative analytics dashboard preview">
          <div className="preview-glow" />
          <div className="dashboard-preview">
            <div className="preview-topbar">
              <div className="preview-brand"><span className="mini-mark"><Activity size={12} /></span> Overview</div>
              <span className="preview-period">Last 7 days <ChevronRight size={12} /></span>
            </div>
            <div className="preview-stats">
              <div className="preview-stat">
                <span>Visitors</span><strong>8,492</strong><small>+12.8% <i>vs previous period</i></small>
              </div>
              <div className="preview-stat">
                <span>Page views</span><strong>24,681</strong><small>+8.3% <i>vs previous period</i></small>
              </div>
              <div className="preview-stat">
                <span>Avg. duration</span><strong>02:41</strong><small>+4.6% <i>vs previous period</i></small>
              </div>
            </div>
            <div className="preview-chart-card">
              <div className="preview-chart-heading"><div><b>Traffic overview</b><span>Visitors over time</span></div><span className="chart-legend"><i /> Visitors</span></div>
              <div className="chart-grid">
                <div className="chart-y"><span>1k</span><span>750</span><span>500</span><span>250</span><span>0</span></div>
                <div className="chart-bars">{sampleBars.map((height, index) => <span key={index} style={{ height: height + "%" }} />)}</div>
              </div>
              <div className="chart-x"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
            </div>
            <div className="preview-bottom">
              <div><span className="preview-label">TOP PAGE</span><b>/products</b></div>
              <div><span className="preview-label">LIVE VISITORS</span><b><i className="live-dot" /> 24 active</b></div>
              <div><span className="preview-label">TOP SOURCE</span><b>Direct</b></div>
            </div>
            <div className="preview-disclaimer">Illustrative preview · Sample data</div>
          </div>
        </div>
      </section>

      <section className="trust-strip section-shell">
        <span>BUILT FOR PEOPLE WHO BUILD THE WEB</span>
        <div><span>INDIE DEVELOPERS</span><span>PRODUCT TEAMS</span><span>BUSINESSES</span><span>CREATORS</span></div>
      </section>

      <section className="features-section section-shell" id="features">
        <div className="section-heading">
          <div className="eyebrow">THE TOOLKIT</div>
          <h2>Everything you need.<br /><span>Nothing in your way.</span></h2>
          <p>From the first visit to the final conversion, see the signals that help you make better decisions.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, description }) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon"><Icon size={19} /></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section section-shell" id="how-it-works">
        <div className="how-copy">
          <div className="eyebrow">UP AND RUNNING IN MINUTES</div>
          <h2>Your website.<br /><span>Your data.</span></h2>
          <p>Create an account, add your website and install one small script. Sentinel takes care of collecting and organising your analytics.</p>
          <Link className="inline-link" href="/signup">Start with a free account <ArrowRight size={15} /></Link>
        </div>
        <div className="steps">
          <div className="step"><span>01</span><div><b>Create your workspace</b><p>Sign up with Google, GitHub or email.</p></div><Check size={17} /></div>
          <div className="step"><span>02</span><div><b>Add your website</b><p>Give your project a name and verify its domain.</p></div><Check size={17} /></div>
          <div className="step"><span>03</span><div><b>Install the tracker</b><p>Copy your unique snippet into your website.</p></div><Check size={17} /></div>
          <div className="step"><span>04</span><div><b>Explore your analytics</b><p>Watch your first events arrive in your dashboard.</p></div><Check size={17} /></div>
        </div>
      </section>

      <section className="privacy-section section-shell" id="privacy">
        <div className="privacy-icon"><ShieldCheck size={22} /></div>
        <div><div className="eyebrow">PRIVACY IS PART OF THE PRODUCT</div><h2>Useful insights.<br /><span>Respectful measurement.</span></h2><p>Sentinel is being designed around data minimisation, clear controls and transparent measurement. Privacy and consent requirements will be built into the tracking setup.</p></div>
      </section>

      <section className="final-cta section-shell">
        <div className="eyebrow">YOUR NEXT DECISION STARTS WITH DATA</div>
        <h2>Make your website<br /><span>make more sense.</span></h2>
        <Link className="button" href="/signup">Get started for free <ArrowRight size={16} /></Link>
      </section>

      <footer className="site-footer section-shell">
        <Link className="brand" href="/"><span className="brand-mark"><Activity size={15} /></span><span>SENTINEL<span className="brand-muted"> ANALYTICS</span></span></Link>
        <span>Website intelligence, made clear.</span>
        <div><a href="#features">Features</a><a href="#privacy">Privacy</a><a href="mailto:contact@sentineldashboard.site">Contact</a></div>
        <small>© {new Date().getFullYear()} Sentinel Analytics. All rights reserved.</small>
      </footer>
    </main>
  );
}
