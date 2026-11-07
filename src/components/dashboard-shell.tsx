import Link from "next/link";
import { Activity, BarChart3, ChevronRight, Command, Globe2, MousePointer2, Settings, Users, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { User } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

type Props = { user: User; active: "overview" | "sites" | "audience" | "events" | "settings"; children: ReactNode };
const items = [
  { id: "overview", label: "Overview", href: "/dashboard", icon: BarChart3, group: "Workspace" },
  { id: "sites", label: "Websites", href: "/dashboard/sites", icon: Globe2, group: "Workspace" },
  { id: "audience", label: "Audience", href: "/dashboard/audience", icon: Users, group: "Reports" },
  { id: "events", label: "Events", href: "/dashboard/events", icon: MousePointer2, group: "Reports" },
] as const;

export default function DashboardShell({ user, active, children }: Props) {
  const initial = user.name.trim().charAt(0).toUpperCase() || "S";
  return <main className="app-shell">
    <aside className="app-sidebar">
      <Link href="/" className="brand brand-sidebar"><span className="brand-mark"><Activity size={17}/></span><span className="brand-word">SENTINEL<span> PULSE</span></span></Link>
      <div className="workspace-card"><div className="workspace-avatar">{initial}</div><div className="workspace-copy"><b>{user.name}'s workspace</b><small>Personal workspace</small></div><span className="workspace-chevron">⌄</span></div>
      <div className="sidebar-group"><span className="sidebar-label">WORKSPACE</span><nav className="sidebar-nav">{items.filter(x=>x.group==="Workspace").map(item=><Link key={item.id} href={item.href} className={active===item.id?"active":""}><item.icon size={17}/><span>{item.label}</span>{active===item.id&&<i/>}</Link>)}</nav></div>
      <div className="sidebar-group"><span className="sidebar-label">ANALYTICS</span><nav className="sidebar-nav">{items.filter(x=>x.group==="Reports").map(item=><Link key={item.id} href={item.href} className={active===item.id?"active":""}><item.icon size={17}/><span>{item.label}</span>{active===item.id&&<i/>}</Link>)}</nav></div>
      <div className="sidebar-spacer"/>
      <div className="sidebar-assistant"><div className="assistant-glow"><Sparkles size={16}/></div><b>Setup made simpler</b><p>Connect a website with the guided AI setup assistant.</p><Link href="/dashboard/sites">Connect a site <ChevronRight size={13}/></Link></div>
      <Link className={"sidebar-settings "+(active==="settings"?"active":"")} href="/dashboard/settings"><Settings size={16}/> Settings</Link>
      <div className="sidebar-user"><div className="user-avatar">{initial}</div><div className="user-copy"><b>{user.name}</b><small>{user.email}</small></div><LogoutButton/></div>
      <div className="sidebar-version"><span><span className="status-dot"/> SYSTEM OPERATIONAL</span><span>v0.1 preview</span></div>
    </aside>
    <section className="app-main">
      <header className="app-topbar"><div className="topbar-breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{items.find(x=>x.id===active)?.label??"Settings"}</b></div><div className="topbar-actions"><div className="topbar-user"><span className="user-avatar">{initial}</span><span>{user.name}</span></div></div></header>
      <div className="app-content">{children}<footer className="app-footer"><span>© 2026 Sentinel Pulse</span><span>Built for clarity <span className="footer-spark">✦</span></span></footer></div>
    </section>
  </main>;
}
