import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default function MonitorsPage() {
  return (
    <div>
      <Link href="/app" className="inline-flex items-center gap-2 text-[11px] text-[#888] hover:text-white"><ArrowLeft size={13}/> Workspace overview</Link>
      <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="text-[10px] uppercase tracking-[.16em] text-[#777]">Monitoring</div><h1 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Monitors</h1><p className="mt-2 text-xs text-[#858585]">Manage the websites and APIs you want Sentinel Pulse to check.</p></div>
        <button disabled className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-[#333] px-4 text-xs font-semibold text-[#888]" title="Monitor creation will be enabled after authentication and database setup"><Plus size={14}/> Add monitor</button>
      </div>
      <div className="mt-8 rounded-xl border border-dashed border-[#303030] bg-[#101010] px-6 py-16 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#303030] bg-[#171717] text-[#999]"><Plus size={19}/></div>
        <h2 className="mt-5 text-sm font-semibold">No monitors yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-[#777]">Your websites and APIs will appear here after you create your first monitor. Monitor creation is part of the next implementation phase.</p>
      </div>
    </div>
  );
}
