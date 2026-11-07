"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, Cloud, Code2, Copy, ExternalLink, Globe2, LoaderCircle, Plus, RefreshCw, ShieldCheck, Sparkles, Terminal, WandSparkles, Workflow } from "lucide-react";

type Site = { id: string; name: string; domain: string; public_key: string; status: string; verified_at: string | null; verification_token: string | null; created_at?: string };
type Provider = "cloudflare" | "vercel" | "wordpress" | "other";
const providers: { id: Provider; name: string; description: string; icon: typeof Cloud }[] = [
  { id: "cloudflare", name: "Cloudflare", description: "Workers, DNS & hosting", icon: Cloud },
  { id: "vercel", name: "Vercel", description: "Deployments & domains", icon: Workflow },
  { id: "wordpress", name: "WordPress", description: "Themes & plugins", icon: Globe2 },
  { id: "other", name: "Other", description: "Custom hosting setup", icon: Code2 },
];

function makeSetupPrompt(site: Site, provider: Provider) {
  const dnsName = "_sentinel." + site.domain;
  const tracker = '<script defer src="https://sentineldashboard.site/tracker.js" data-site="' + site.public_key + '"></script>';
  const providerGuide: Record<Provider, string> = {
    cloudflare: "You are working with a website that may use Cloudflare. Inspect the connected Cloudflare account, DNS zone and website repository/project. Use only tools that are already available and explicitly authorized. Create the DNS TXT record at the authoritative Cloudflare zone if it is accessible. If the source repository or deployment is also connected, install the tracker in the shared document head or global layout.",
    vercel: "Inspect the connected Vercel project and identify where its DNS is managed. Do not assume that Vercel controls DNS. If the DNS provider and source repository are accessible, add the TXT record at the authoritative DNS provider and install the tracker in the global layout or document head.",
    wordpress: "Inspect the connected WordPress site and determine whether you have authorized access to its theme, global header or site-wide code integration. Install the tracker globally, not in an individual post or page. DNS verification must be created at the authoritative DNS provider.",
    other: "Inspect the website's actual hosting platform, source code and authoritative DNS provider. Identify the correct global document head/layout and DNS zone before making any changes."
  };
  const dnsSection = site.verified_at
    ? "DOMAIN VERIFICATION\nThe domain is already verified in Sentinel. Do not change or recreate its verification record."
    : "DOMAIN VERIFICATION — ADD THIS DNS RECORD\nRecord type: TXT\nHost / name: " + dnsName + "\nValue: " + (site.verification_token ?? "") + "\nTTL: Auto / provider default\nAdd this record only. Do not replace existing records. DNS interfaces may display TXT values with quotation marks; enter the exact value without manually adding quotes unless the provider's interface requires them.";
  const trackerSection = "TRACKING INSTALLATION\nInstall this exact script once on every public page using the site's shared HTML head, root layout or global header integration. Do not add it separately to individual pages if a global location exists.\n\n" + tracker + "\n\nTracker URL: https://sentineldashboard.site/tracker.js\nPublic site identifier: " + site.public_key;
  return [
    "TASK: Configure Sentinel Pulse website analytics for " + site.domain,
    "",
    "ROLE & ENVIRONMENT",
    providerGuide[provider],
    "",
    dnsSection,
    "",
    trackerSection,
    "",
    "EXECUTION PLAN",
    "1. Inspect the existing project, DNS zone and deployment setup. Report the exact files and DNS zone you intend to touch before editing.",
    "2. Add only the Sentinel TXT record above if domain verification is still pending and you have permission to edit the authoritative DNS zone.",
    "3. Add the tracking script exactly once in the shared/global page head. Preserve the framework's existing conventions and formatting.",
    "4. Check for an existing Sentinel tracker before adding it, to avoid duplicate pageview collection.",
    "5. Run the project's normal validation/build checks if source files were changed. Do not deploy unless the connected workflow normally permits deployment and the changes pass validation.",
    "6. Report the exact DNS record and file changed, the validation result, and anything you could not complete.",
    "",
    "STRICT SAFETY RULES",
    "- Never delete, replace or edit unrelated DNS records, routes, files, settings or environment variables.",
    "- Never request, reveal, create or modify API tokens, passwords, private keys or other credentials.",
    "- The Sentinel site identifier is public tracking configuration, not an account credential.",
    "- Do not edit Sentinel's own backend or Worker. Only configure the website being connected.",
    "- Do not invent test traffic, fabricate analytics, or claim verification before DNS can be observed publicly.",
    "- If you lack access to DNS or source code, stop that step and give precise manual instructions. Do not pretend it was completed.",
    "- Ask for confirmation before any destructive, broad or unrelated change.",
    "",
    "SENTINEL DETAILS",
    "Website: https://" + site.domain,
    "Verification hostname: " + dnsName,
    "Tracker endpoint: https://sentineldashboard.site/api/collect",
    "Tracking script: https://sentineldashboard.site/tracker.js",
    "Site identifier: " + site.public_key,
    "",
    "IMPORTANT: After the changes, I will return to Sentinel Pulse and click “Verify domain”. Do not claim Sentinel verification succeeded until that check passes."
  ].join("\n");
}

export default function SitesManager() {
  const [sites, setSites] = useState<Site[]>([]);
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [providerBySite, setProviderBySite] = useState<Record<string, Provider>>({});
  const [generatedFor, setGeneratedFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/sites", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setSites(data.sites ?? []);
      else setError(data.error ?? "Could not load websites.");
    } catch { setError("Could not load websites. Please refresh the page."); }
    finally { setReady(true); }
  }
  useEffect(() => { void load(); }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain, name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not add website.");
      setSites(current => [data.site, ...current]); setDomain(""); setName(""); setGeneratedFor(data.site.id);
      setMessage("Website added. Your personalized setup guide is ready to generate.");
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  async function verify(id: string) {
    setChecking(id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/sites/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: id }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "The DNS record could not be found yet.");
      setMessage("Domain verified successfully. Install the tracker to start collecting page views.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Verification failed."); }
    finally { setChecking(null); }
  }

  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(current => current === key ? null : current), 2200); }
    catch { setError("Clipboard access was blocked by your browser. Select and copy the prompt manually."); }
  }

  return <div className="sites-workspace">
    <section className="connect-hero">
      <div className="connect-hero-copy"><div className="section-kicker"><span className="kicker-dot"/> WEBSITE MANAGEMENT</div><h2>Bring your data<br/><span>into focus.</span></h2><p>Connect your domain once. Sentinel checks ownership, then collects real page views from your website.</p><div className="connect-trust"><span><ShieldCheck size={14}/> Verified domains only</span><span><Activity size={14}/> No fake traffic</span></div></div>
      <div className="connect-orbit" aria-hidden="true"><div className="orbit-ring orbit-ring-one"/><div className="orbit-ring orbit-ring-two"/><div className="orbit-ring orbit-ring-three"/><div className="orbit-center"><Activity size={31}/></div><span className="orbit-chip chip-one"><Globe2 size={15}/></span><span className="orbit-chip chip-two"><CheckCircle2 size={15}/></span><span className="orbit-chip chip-three"><Sparkles size={15}/></span></div>
    </section>

    <section className="connect-form-card">
      <div className="connect-form-heading"><div className="connect-form-icon"><Plus size={18}/></div><div><h3>Connect a new website</h3><p>Start with your domain. We'll prepare the setup steps for you.</p></div><span className="step-counter">STEP 01 <i/> DOMAIN</span></div>
      <form onSubmit={add} className="connect-form"><label><span>Website domain</span><div className="input-with-icon"><Globe2 size={16}/><input value={domain} onChange={e => setDomain(e.target.value)} placeholder="yourwebsite.com" required autoComplete="url"/></div><small>Enter your root domain, without a page path.</small></label><label><span>Display name <em>OPTIONAL</em></span><div className="input-with-icon"><Command size={16}/><input value={name} onChange={e => setName(e.target.value)} placeholder="My website"/></div><small>A name to help you recognize this project.</small></label><button className="button connect-submit" disabled={busy || !domain.trim()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>} Add website <ArrowRight size={15}/></button></form>
    </section>

    {error && <div className="feedback-banner feedback-error">{error}</div>}
    {message && <div className="feedback-banner feedback-success"><CheckCircle2 size={16}/>{message}</div>}

    <div className="sites-section-heading"><div><div className="section-kicker">YOUR WORKSPACE</div><h2>Connected websites <span>{sites.length}</span></h2></div><button type="button" className="subtle-action" onClick={() => void load()}><RefreshCw size={14}/> Refresh</button></div>

    {!ready ? <div className="sites-loading"><LoaderCircle className="spin" size={19}/> Loading your websites…</div> : sites.length === 0 ? <div className="sites-empty"><div className="empty-visual"><Globe2 size={25}/></div><h3>Your workspace is ready for its first site</h3><p>Add a domain above and Sentinel will guide you through the connection process.</p></div> : <div className="sites-list">{sites.map(site => {
      const provider = providerBySite[site.id] ?? "cloudflare";
      const prompt = makeSetupPrompt(site, provider);
      const isOpen = generatedFor === site.id;
      return <article className="site-card" key={site.id}>
        <div className="site-card-top"><div className="site-identity"><div className="site-favicon"><Globe2 size={19}/></div><div><h3>{site.name || site.domain}</h3><a href={"https://" + site.domain} target="_blank" rel="noreferrer">{site.domain} <ExternalLink size={11}/></a></div></div><span className={"site-state " + (site.verified_at ? "is-verified" : "is-pending")}><i/>{site.verified_at ? "Domain verified" : "Awaiting verification"}</span></div>
        <div className="site-progress"><div className={"progress-step complete"}><span><Check size={12}/></span><div><b>Domain added</b><small>Saved to your workspace</small></div></div><div className={"progress-connector " + (site.verified_at ? "complete" : "")}/><div className={"progress-step " + (site.verified_at ? "complete" : "current")}><span>{site.verified_at ? <Check size={12}/> : "2"}</span><div><b>Verify ownership</b><small>{site.verified_at ? "DNS check passed" : "Add one TXT record"}</small></div></div><div className={"progress-connector " + (site.verified_at ? "complete" : "")}/><div className="progress-step"><span>3</span><div><b>Install tracker</b><small>Start receiving page views</small></div></div></div>
        {!site.verified_at && <div className="dns-inline"><div className="dns-inline-icon"><ShieldCheck size={17}/></div><div className="dns-inline-copy"><b>One DNS record is needed</b><span>Add a TXT record at <strong>{site.domain}</strong> to prove you own this domain.</span></div><button type="button" className="text-button" onClick={() => setGeneratedFor(isOpen ? null : site.id)}>{isOpen ? "Hide setup" : "Set up with AI"} <ArrowRight size={14}/></button></div>}
        {site.verified_at && <div className="verified-inline"><CheckCircle2 size={17}/><div><b>Ownership confirmed</b><span>Your domain is trusted. Finish the tracker installation to start receiving real data.</span></div><button type="button" className="text-button" onClick={() => setGeneratedFor(isOpen ? null : site.id)}>{isOpen ? "Hide setup" : "Install tracker"} <ArrowRight size={14}/></button></div>}
        {isOpen && <div className="ai-setup-panel">
          <div className="ai-panel-heading"><div className="ai-panel-icon"><WandSparkles size={19}/></div><div><span className="section-kicker">SENTINEL AI SETUP</span><h3>Your setup, prepared for AI.</h3><p>Choose where your website is managed. We'll generate precise instructions for that environment.</p></div></div>
          <div className="provider-grid">{providers.map(item => {const Icon = item.icon;return <button key={item.id} type="button" className={"provider-option " + (provider === item.id ? "selected" : "")} onClick={() => setProviderBySite(current => ({ ...current, [site.id]: item.id }))}><span className="provider-icon"><Icon size={18}/></span><span><b>{item.name}</b><small>{item.description}</small></span><i>{provider === item.id && <Check size={12}/>}</i></button>})}</div>
          <div className="prompt-builder-head"><div><span className="section-kicker">GENERATED INSTRUCTIONS</span><h4>Installation prompt</h4></div><span className="prompt-ready"><span/> PERSONALIZED</span></div>
          <div className="prompt-editor"><div className="prompt-editor-bar"><div className="editor-dots"><i/><i/><i/></div><span><Terminal size={13}/> sentinel-setup.prompt</span><small>{prompt.length.toLocaleString("en-US")} characters</small></div><div className="prompt-editor-body"><div className="prompt-line-numbers">{prompt.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div><pre>{prompt}</pre></div></div>
          <div className="prompt-actions"><button type="button" className="button prompt-copy" onClick={() => void copy(prompt, site.id)}>{copied === site.id ? <ClipboardCheck size={16}/> : <Copy size={16}/>} {copied === site.id ? "Copied to clipboard" : "Copy full prompt"}</button><a className="button button-secondary" href={provider === "cloudflare" ? "https://dash.cloudflare.com/" : provider === "vercel" ? "https://vercel.com/dashboard" : provider === "wordpress" ? "https://wordpress.com/home" : "https://sentineldashboard.site"} target="_blank" rel="noreferrer">Open {providers.find(x => x.id === provider)?.name} <ExternalLink size={14}/></a></div>
          <div className="prompt-note"><ShieldCheck size={16}/><p><b>Safe by design.</b> This prompt tells the AI to preserve existing settings, touch only the required DNS record and tracker integration, and never expose credentials. The AI still needs access to your project and DNS provider to make changes.</p></div>
          <div className="setup-manual-fallback"><details><summary><span><Code2 size={14}/> View manual setup details</span><ChevronDown size={15}/></summary>{!site.verified_at && <div className="manual-dns"><div><span>DNS RECORD</span><b>TXT</b></div><div><span>HOST / NAME</span><code>_sentinel</code></div><div className="manual-dns-value"><span>VALUE</span><code>{site.verification_token}</code></div><button type="button" className="icon-only" onClick={() => void copy("_sentinel." + site.domain + " TXT " + site.verification_token, site.id + "-dns")} aria-label="Copy DNS details">{copied === site.id + "-dns" ? <Check size={15}/> : <Copy size={15}/>}</button></div>}<div className="manual-tracker"><span>TRACKING SCRIPT</span><code>{'<script defer src="https://sentineldashboard.site/tracker.js" data-site="' + site.public_key + '"></script>'}</code><button type="button" className="icon-only" onClick={() => void copy('<script defer src="https://sentineldashboard.site/tracker.js" data-site="' + site.public_key + '"></script>', site.id + "-tracker")} aria-label="Copy tracker snippet">{copied === site.id + "-tracker" ? <Check size={15}/> : <Copy size={15}/>}</button></div></details></div>
          {!site.verified_at ? <div className="verify-action-row"><div><b>Finished adding the DNS record?</b><span>DNS updates can take a little time to become visible.</span></div><button className="button verify-button" type="button" onClick={() => void verify(site.id)} disabled={checking === site.id}>{checking === site.id ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} Verify domain</button></div> : <div className="verify-action-row"><div><b>Next: publish the tracker</b><span>Once the script is live, page views will begin appearing automatically.</span></div><span className="verified-pill"><CheckCircle2 size={14}/> Domain verified</span></div>}
        </div>}
      </article>;
    })}</div>}

    <div className="privacy-footnote"><ShieldCheck size={17}/><div><b>Privacy-conscious analytics</b><span>Sentinel does not store raw IP addresses. Visitor counts are estimates based on a one-way hash of network and browser signals. Reports never include sample traffic.</span></div></div>
  </div>;
}
