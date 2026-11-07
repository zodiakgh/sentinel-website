import Link from "next/link";
import { Activity, AlertCircle, Bell, CircleHelp, Globe, LayoutDashboard, Radio, Settings2, ShieldCheck } from "lucide-react";

const navigation = [
  { label: "Overview", href: "/app", icon: LayoutDashboard },
  { label: "Monitors", href: "/app/monitors", icon: Globe },
  { label: "Analytics", href: "/app/analytics", icon: Activity },
  { label: "Incidents", href: "/app/incidents", icon: AlertCircle },
  { label: "Status pages", href: "/app/status-pages", icon: Radio },
  { label: "SSL & Domains", href: "/app/domains", icon: ShieldCheck }
];

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#090909] text-[#f2f2f2] md:grid md:grid-cols-[236px_1fr]">
      <aside className="hidden min-h-screen border-r border-[#252525] bg-[#0d0d0d] md:flex md:flex-col">
        <Link href="/" className="flex h-[72px] items-center gap-3 border-b border-[#252525] px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#333] bg-[#171717]"><Activity size={16}/></span>
          <span className="text-xs font-semibold tracking-[.16em]">SENTINEL <span className="text-[#777]">PULSE</span></span>
        </Link>
        <div className="px-4 pt-6">
          <div className="px-3 text-[9px] font-semibold tracking-[.16em] text-[#666]">WORKSPACE</div>
          <button className="mt-3 flex w-full items-center justify-between rounded-lg border border-[#292929] bg-[#151515] px-3 py-2.5 text-left text-xs">
            <span>Personal workspace</span><span className="text-[#777]">⌄</span>
          </button>
        </div>
        <nav className="mt-7 flex-1 px-3">
          <div className="mb-2 px-3 text-[9px] font-semibold tracking-[.16em] text-[#666]">MONITORING</div>
          <div className="space-y-1">
            {navigation.map(({label,href,icon:Icon},i)=>(
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs transition ${i===0?"bg-[#202020] text-white":"text-[#929292] hover:bg-[#171717] hover:text-white"}`}>
                <Icon size={15}/>{label}
              </Link>
            ))}
          </div>
          <div className="mb-2 mt-8 px-3 text-[9px] font-semibold tracking-[.16em] text-[#666]">PREFERENCES</div>
          <Link href="/app/notifications" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-[#929292] hover:bg-[#171717] hover:text-white"><Bell size={15}/>Notifications</Link>
          <Link href="/app/settings" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-[#929292] hover:bg-[#171717] hover:text-white"><Settings2 size={15}/>Settings</Link>
        </nav>
        <div className="border-t border-[#252525] p-4">
          <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-[#777]"><CircleHelp size={14}/>Documentation</div>
          <div className="mt-3 rounded-lg border border-[#292929] bg-[#141414] p-3">
            <div className="text-[10px] font-medium">Workspace preview</div>
            <div className="mt-1 text-[10px] leading-5 text-[#777]">Sign in and create a workspace to start monitoring.</div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex h-[72px] items-center justify-between border-b border-[#252525] px-5 sm:px-8">
          <div className="flex items-center gap-2 text-xs text-[#777] md:hidden"><Activity size={16}/> SENTINEL PULSE</div>
          <div className="hidden text-xs text-[#777] md:block">Workspace <span className="px-2 text-[#444]">/</span><span className="text-[#ddd]">Overview</span></div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#303030] px-2.5 py-1 text-[9px] uppercase tracking-wider text-[#929292]">Preview</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#333] bg-[#191919] text-[10px]">—</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
