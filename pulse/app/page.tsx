import Link from "next/link";
import { Activity, ArrowRight, Bell, Check, Globe, ShieldCheck } from "lucide-react";

const capabilities = [
  { icon: Globe, title: "Uptime monitoring", text: "Know when a website or API becomes unavailable, with checks and a clear history." },
  { icon: Activity, title: "Performance analytics", text: "Understand response times and reliability trends instead of guessing." },
  { icon: Bell, title: "Incident response", text: "Turn confirmed failures into incidents your team can investigate and resolve." },
  { icon: ShieldCheck, title: "Public status pages", text: "Give customers a transparent view of service health and incident updates." }
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pulse-grid pointer-events-none absolute inset-x-0 top-0 h-[680px]" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#333] bg-[#151515]"><Activity size={18} /></span>
          <span className="text-sm font-semibold tracking-[.19em]">SENTINEL<span className="text-[#858585]"> PULSE</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-xs text-[#a1a1a1] md:flex">
          <a href="#platform" className="hover:text-white">Platform</a>
          <a href="#capabilities" className="hover:text-white">Capabilities</a>
          <a href="#reliability" className="hover:text-white">Reliability</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/app" className="button-primary">Open dashboard <ArrowRight size={14} /></Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-10 lg:pb-32 lg:pt-28">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#303030] bg-[#111]/80 px-3 py-2 text-[11px] text-[#b5b5b5]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#36a477]" /> Infrastructure visibility, without the noise
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-[72px]">
            Reliability starts with <span className="text-[#858585]">visibility.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#929292]">
            Monitor your websites and APIs, understand incidents and keep your services accountable from one focused workspace.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/app" className="button-primary">Explore the dashboard <ArrowRight size={15} /></Link>
            <a href="#capabilities" className="button-secondary">Explore the platform</a>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-[11px] text-[#777]">
            <span className="flex items-center gap-2"><Check size={13} /> Website & API checks</span>
            <span className="flex items-center gap-2"><Check size={13} /> Incident history</span>
            <span className="flex items-center gap-2"><Check size={13} /> Team workspaces</span>
          </div>
        </div>

        <div id="platform" className="panel relative p-4 shadow-2xl shadow-black/40 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#292929] pb-4">
            <div>
              <div className="text-xs font-medium">Workspace overview</div>
              <div className="mt-1 text-[10px] text-[#777]">A clear view of service health</div>
            </div>
            <span className="rounded-full border border-[#28503f] bg-[#102219] px-2.5 py-1 text-[10px] text-[#76c69f]">Concept preview</span>
          </div>
          <div className="grid grid-cols-2 gap-3 py-4">
            {[["MONITORS","—"],["UPTIME","—"],["AVG. RESPONSE","—"],["OPEN INCIDENTS","—"]].map(([label,value]) => (
              <div key={label} className="rounded-lg border border-[#292929] bg-[#101010] p-4">
                <div className="text-[9px] tracking-[.13em] text-[#777]">{label}</div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
                <div className="mt-1 text-[10px] text-[#666]">Awaiting workspace data</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-[#292929] bg-[#101010] p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium">Service activity</span>
              <span className="text-[10px] text-[#777]">No data yet</span>
            </div>
            <div className="flex h-24 items-end gap-1.5 opacity-40">
              {Array.from({length:36},(_,i)=><span key={i} className="flex-1 rounded-t-sm bg-[#626262]" style={{height:"3px"}} />)}
            </div>
            <p className="mt-3 text-[10px] text-[#666]">Live metrics will appear after the first monitor is configured.</p>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-y border-[#202020] bg-[#0d0d0d] px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="eyebrow">One platform. Clear signals.</div>
          <div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Everything you need to understand service health.</h2>
            <p className="max-w-sm text-sm leading-6 text-[#858585]">Start with uptime. Build toward a complete operational picture as your team grows.</p>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({icon:Icon,title,text})=>(
              <article key={title} className="rounded-xl border border-[#282828] bg-[#111] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#303030] bg-[#181818]"><Icon size={18} /></div>
                <h3 className="mt-6 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-6 text-[#858585]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="reliability" className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-20 md:flex-row md:items-center md:justify-between lg:px-10">
        <div>
          <div className="eyebrow">Built for technical teams</div>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-.04em]">Less noise. Better decisions.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#858585]">A focused workspace for developers and businesses that need dependable visibility into their services.</p>
        </div>
        <Link href="/app" className="button-secondary shrink-0">View workspace preview <ArrowRight size={14} /></Link>
      </section>

      <footer className="border-t border-[#202020] px-6 py-7 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-[10px] text-[#666] sm:flex-row">
          <span className="tracking-[.16em]">SENTINEL PULSE</span>
          <span>Independent product · Not affiliated with the former Sentinel Discord bot</span>
          <span>© 2026 Sentinel Pulse</span>
        </div>
      </footer>
    </main>
  );
}
