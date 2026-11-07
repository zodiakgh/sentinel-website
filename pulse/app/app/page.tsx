import Link from "next/link";
import { ArrowRight, Plus, Activity, Globe, AlertCircle } from "lucide-react";

const cards = [
  { label: "MONITORS", value: "—", note: "No monitors configured", icon: Globe },
  { label: "UPTIME", value: "—", note: "Awaiting first checks", icon: Activity },
  { label: "AVG. RESPONSE", value: "—", note: "No response data", icon: Activity },
  { label: "OPEN INCIDENTS", value: "—", note: "No incident data", icon: AlertCircle }
];

export default function DashboardPage() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-[10px] uppercase tracking-[.16em] text-[#777]">WORKSPACE / OVERVIEW</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Workspace overview</h1>
          <p className="mt-2 text-xs text-[#858585]">A central view of your monitored services and operational health.</p>
        </div>
        <Link href="/app/monitors/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ededed] px-4 text-xs font-semibold text-[#111] hover:bg-white"><Plus size={14}/> Add monitor</Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({label,value,note,icon:Icon})=>(
          <section key={label} className="rounded-xl border border-[#292929] bg-[#111] p-4">
            <div className="flex items-center justify-between text-[9px] font-semibold tracking-[.14em] text-[#777]"><span>{label}</span><Icon size={15}/></div>
            <div className="mt-5 text-3xl font-semibold tracking-tight">{value}</div>
            <div className="mt-2 text-[10px] text-[#666]">{note}</div>
          </section>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-[#292929] bg-[#111] p-5">
          <div className="flex items-center justify-between">
            <div><h2 className="text-xs font-semibold">Service performance</h2><p className="mt-1 text-[10px] text-[#777]">Response time history</p></div>
            <span className="text-[10px] text-[#666]">No data</span>
          </div>
          <div className="mt-6 flex h-44 items-center justify-center rounded-lg border border-dashed border-[#303030] bg-[#0d0d0d]">
            <div className="text-center"><Activity className="mx-auto text-[#555]" size={22}/><p className="mt-3 text-xs text-[#888]">Your performance data will appear here</p><p className="mt-1 text-[10px] text-[#606060]">Add a monitor to begin collecting measurements.</p></div>
          </div>
        </section>
        <section className="rounded-xl border border-[#292929] bg-[#111] p-5">
          <h2 className="text-xs font-semibold">Getting started</h2>
          <p className="mt-1 text-[10px] text-[#777]">Set up your first monitoring workspace.</p>
          <div className="mt-5 space-y-4">
            {["Create your account","Set up a workspace","Add your first monitor","Configure notifications"].map((item,i)=>(
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#333] text-[10px] text-[#888]">{i+1}</span>
                <span className="text-[11px] text-[#aaa]">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-[#292929] pt-4">
            <div className="text-[10px] leading-5 text-[#777]">This is an early product preview. Authentication, workspace creation and live monitoring are not connected yet.</div>
            <Link href="/" className="mt-4 inline-flex items-center gap-2 text-[11px] text-[#ddd] hover:text-white">Back to product overview <ArrowRight size={13}/></Link>
          </div>
        </section>
      </div>
    </div>
  );
}
