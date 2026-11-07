import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";

export default function NewMonitorPage() {
  return (
    <div>
      <Link href="/app/monitors" className="inline-flex items-center gap-2 text-[11px] text-[#888] hover:text-white"><ArrowLeft size={13}/> Monitors</Link>
      <div className="mt-7 max-w-2xl rounded-xl border border-[#292929] bg-[#111] p-7 sm:p-9">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#303030] bg-[#181818] text-[#aaa]"><Globe size={19}/></div>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-.04em]">Add a monitor</h1>
        <p className="mt-3 text-xs leading-6 text-[#888]">Monitor creation will be enabled after the authentication, workspace database and monitoring engine are connected.</p>
        <div className="mt-7 rounded-lg border border-dashed border-[#333] bg-[#0d0d0d] p-4 text-[11px] leading-5 text-[#777]">No URL is being collected or checked yet. This preview does not send requests to external websites.</div>
      </div>
    </div>
  );
}
