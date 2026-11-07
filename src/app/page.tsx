import { Activity, ArrowRight, BellRing, ChartNoAxesCombined, Check, ChevronRight, CircleDot, Globe2, ShieldCheck, Zap } from "lucide-react";

const metrics = [
  { label: "Services monitored", value: "—" },
  { label: "Uptime", value: "—" },
  { label: "Active incidents", value: "—" }
];

const capabilities = [
  { icon: Activity, title: "Uptime monitoring", text: "Know when a website or API becomes unavailable, with checks built around your services." },
  { icon: ChartNoAxesCombined, title: "Performance analytics", text: "Understand response times and reliability trends with clear, useful history." },
  { icon: BellRing, title: "Incident alerts", text: "Bring the right information to your team when a service needs attention." },
  { icon: Globe2, title: "Public status pages", text: "Share service health and incident updates through a status page you control." },
  { icon: ShieldCheck, title: "SSL & domain health", text: "Keep an eye on certificate validity and important domain configuration." },
  { icon: Zap, title: "Developer platform", text: "Connect your workflow with an API, webhooks and developer-friendly tools." }
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="relative z-10 border-b border-white/[0.08]">
        <nav className="shell flex h-[76px] items-center justify-between">
          <a href="/" className="flex items-center gap-3" aria-label="Sentinel Pulse home">
            <span className="grid size-9 place-items-center rounded-lg border border-white/15 bg-white/[0.04]"><Activity size={18} /></span>
            <span className="text-[15px] font-semibold tracking-[0.16em]">SENTINEL <span className="text-neutral-500">PULSE</span></span>
          </a>
          <div className="hidden items-center gap-8 text-sm text-neutral-400 md:flex">
            <a className="transition hover:text-white" href="#platform">Platform</a>
            <a className="transition hover:text-white" href="#capabilities">Capabilities</a>
            <a className="transition hover:text-white" href="#approach">Our approach</a>
          </div>
          <a href="mailto:hello@sentinel.example" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white transition hover:border-white/40 hover:bg-white/[0.05]">
            Get in touch <ArrowRight size={14} />
          </a>
        </nav>
      </header>

      <section className="relative border-b border-white/[0.07]">
        <div className="grid-lines pointer-events-none absolute inset-0" />
        <div className="shell relative grid min-h-[660px] items-center gap-16 py-24 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-neutral-300">
              <span className="size-1.5 rounded-full bg-neutral-200" /> A clearer view of service reliability
            </div>
            <p className="eyebrow mb-6">Monitoring · Observability · Reliability</p>
            <h1 className="max-w-[700px] text-5xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-[76px]">
              Know when it matters. <span className="text-neutral-500">Understand why.</span>
            </h1>
            <p className="mt-7 max-w-[540px] text-base leading-8 text-neutral-400 sm:text-lg">
              Sentinel Pulse brings website and API monitoring, performance insights and incident workflows into one focused workspace.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a href="#platform" className="inline-flex items-center gap-3 rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200">Explore the platform <ArrowRight size={16} /></a>
              <a href="#capabilities" className="rounded-lg border border-white/15 px-5 py-3.5 text-sm text-neutral-300 transition hover:bg-white/[0.05]">Discover capabilities</a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-xs text-neutral-500">
              <span className="flex items-center gap-2"><Check size={14} /> Built for technical teams</span>
              <span className="flex items-center gap-2"><Check size={14} /> Clear operational visibility</span>
            </div>
          </div>

          <div id="platform" className="panel relative p-5 shadow-2xl shadow-black/50 sm:p-6">
            <div className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div><p className="text-sm font-medium">Workspace overview</p><p className="mt-1 text-xs text-neutral-500">Preview · Sample interface</p></div>
              <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-neutral-300"><CircleDot size={11} /> Preview</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {metrics.map((metric) => <div key={metric.label} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-xl font-semibold tracking-tight sm:text-2xl">{metric.value}</p><p className="mt-2 text-[10px] leading-4 text-neutral-500 sm:text-xs">{metric.label}</p></div>)}
            </div>
            <div className="mt-5 rounded-lg border border-white/[0.07] bg-black/20 p-4">
              <div className="mb-5 flex items-center justify-between"><p className="text-xs font-medium text-neutral-300">Service response overview</p><span className="text-[10px] text-neutral-500">Illustrative preview</span></div>
              <div className="flex h-32 items-end gap-1.5">
                {[38,48,43,57,51,64,59,72,62,69,77,65,73,84,70,78,88,76,82,91,79,86,73,84,94,81,89,78,87,96,85,91,80,88,97,86].map((height, index) => <div key={index} className="flex-1 rounded-t-[2px] bg-neutral-500/60" style={{ height: height + "%" }} />)}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-neutral-600"><span>Earlier</span><span>Now</span></div>
            </div>
            <div className="mt-4 space-y-2">
              {["Website availability", "API response checks", "Incident timeline"].map((item) => <div key={item} className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-3"><span className="text-xs text-neutral-300">{item}</span><span className="text-[10px] text-neutral-500">Product preview <ChevronRight size={12} className="ml-1 inline" /></span></div>)}
            </div>
            <p className="mt-4 text-[10px] leading-5 text-neutral-600">Illustrative interface only. No live monitoring data is displayed at this stage.</p>
          </div>
        </div>
      </section>

      <section id="capabilities" className="shell py-28">
        <div className="max-w-2xl"><p className="eyebrow">One operational workspace</p><h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">The essentials to keep services reliable.</h2><p className="mt-5 leading-7 text-neutral-400">A connected toolkit for understanding service health, responding to incidents and communicating clearly.</p></div>
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.035]"><span className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04]"><Icon size={18} /></span><h3 className="mt-6 text-base font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-neutral-500">{text}</p></article>)}
        </div>
      </section>

      <section id="approach" className="border-y border-white/[0.07] bg-white/[0.018]">
        <div className="shell grid gap-12 py-20 md:grid-cols-[.8fr_1.2fr] md:items-center">
          <div><p className="eyebrow">Designed for clarity</p><h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Less noise. Better decisions.</h2></div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div><p className="text-sm font-medium">A focused interface</p><p className="mt-2 text-sm leading-6 text-neutral-500">Important signals stay visible without burying teams in unnecessary complexity.</p></div>
            <div><p className="text-sm font-medium">Built to grow</p><p className="mt-2 text-sm leading-6 text-neutral-500">A foundation for workspaces, integrations, reporting and more advanced monitoring.</p></div>
          </div>
        </div>
      </section>

      <footer className="shell flex flex-col gap-4 py-8 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold tracking-[0.16em] text-neutral-400">SENTINEL PULSE</span>
        <span>Independent platform · Website and API reliability</span>
        <span>© {new Date().getFullYear()} Sentinel Pulse</span>
      </footer>
    </main>
  );
}
