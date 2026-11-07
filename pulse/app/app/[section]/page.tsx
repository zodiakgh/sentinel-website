import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { notFound } from "next/navigation";

const sections: Record<string, { title: string; description: string; phase: string }> = {
  analytics: { title: "Analytics", description: "Uptime, response-time percentiles and historical performance reporting.", phase: "Phase 3" },
  incidents: { title: "Incidents", description: "Investigate service disruptions, track updates and document resolutions.", phase: "Phase 4" },
  "status-pages": { title: "Status pages", description: "Publish a clear service-health page for your customers.", phase: "Phase 5" },
  domains: { title: "SSL & Domains", description: "Track certificate validity, expiration dates and DNS changes.", phase: "Phase 5" },
  notifications: { title: "Notifications", description: "Configure email alerts, webhook destinations and notification rules.", phase: "Phase 4" },
  settings: { title: "Settings", description: "Manage workspace preferences, members and account configuration.", phase: "Phase 1" }
};

export default async function WorkspaceSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = sections[section];
  if (!item) notFound();

  return (
    <div>
      <Link href="/app" className="inline-flex items-center gap-2 text-[11px] text-[#888] hover:text-white"><ArrowLeft size={13}/> Workspace overview</Link>
      <div className="mt-7 max-w-2xl rounded-xl border border-[#292929] bg-[#111] p-7 sm:p-9">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#303030] bg-[#181818] text-[#aaa]"><Construction size={19}/></div>
        <div className="mt-7 text-[10px] uppercase tracking-[.16em] text-[#777]">{item.phase}</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em]">{item.title}</h1>
        <p className="mt-3 max-w-lg text-xs leading-6 text-[#888]">{item.description}</p>
        <div className="mt-7 border-t border-[#292929] pt-5 text-[11px] leading-5 text-[#777]">This section is part of the Sentinel Pulse roadmap. It will become available as its backend and data model are implemented.</div>
      </div>
    </div>
  );
}
