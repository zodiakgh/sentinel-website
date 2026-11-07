"use client";

import { ArrowUpRight, ExternalLink, Search, SlidersHorizontal, ShieldCheck, X, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Software = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  website_url: string;
  source_url: string;
  repository_host: string | null;
  license_name: string;
  spdx_id: string;
  license_url: string | null;
  pricing_status: "free" | "freemium" | "paid" | "unverified";
  categories: string | null;
};

export function SoftwareLogo({ name, website, size = "large" }: { name: string; website: string; size?: "small" | "large" }) {
  const [failed, setFailed] = useState(false);
  let favicon = "";
  try {
    const host = new URL(website).hostname;
    favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    setFailed(true);
  }
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] ${size === "large" ? "size-14" : "size-11"}`}>
      {!failed && favicon ? (
        <img src={favicon} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" className={`${size === "large" ? "size-8" : "size-6"} object-contain`} onError={() => setFailed(true)} />
      ) : (
        <span className="text-lg font-bold tracking-tight text-[#d9ff66]">{name.trim().charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

const categoryOptions = [
  ["", "All software"], ["development", "Development"], ["creative", "Design & Creative"],
  ["productivity", "Productivity"], ["privacy-security", "Privacy & Security"],
  ["self-hosting", "Self-hosting"], ["education", "Education"], ["utilities", "Utilities"],
  ["communication", "Communication"], ["databases", "Databases"], ["gaming", "Gaming"],
];

export function SoftwareSearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<Software[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);\n  const [error, setError] = useState(false);

  async function runSearch(searchQuery = query, searchCategory = category) {
    setLoading(true);
    setSearched(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (searchCategory) params.set("category", searchCategory);
      const response = await fetch(`/api/software?${params.toString()}`);
      if (!response.ok) throw new Error("Catalog unavailable");
      const data = await response.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function search(event?: FormEvent) {
    event?.preventDefault();
    await runSearch();
  }

  function clearFilters() {
    setQuery("");
    setCategory("");
    void runSearch("", "");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedCategory = params.get("category") ?? "";
    const validCategory = categoryOptions.some(([value]) => value === requestedCategory);
    const initialCategory = validCategory ? requestedCategory : "";
    setCategory(initialCategory);
    void runSearch("", initialCategory);
  }, []);

  return (
    <div id="search" className="mx-auto mt-10 max-w-5xl scroll-mt-8">
      <form onSubmit={search} className="rounded-2xl border border-white/[0.12] bg-[#111] p-2 shadow-[0_24px_90px_rgba(0,0,0,0.38)]">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3">
            <Search className="size-5 shrink-0 text-neutral-500" />
            <input aria-label="Search software" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, use case or feature..." className="min-w-0 flex-1 bg-transparent py-4 text-[15px] text-white outline-none placeholder:text-neutral-500" />
            <kbd className="hidden rounded-md border border-white/10 px-2 py-1 text-[10px] text-neutral-500 sm:block">ENTER</kbd>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3">
              <SlidersHorizontal className="size-4 text-neutral-500" />
              <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-neutral-200 outline-none">
                {categoryOptions.map(([value, label]) => <option key={value} value={value} className="bg-[#151515]">{label}</option>)}
              </select>
            </label>
            <button type="submit" disabled={loading} className="group flex items-center justify-center gap-2 rounded-xl bg-[#d9ff66] px-6 py-3.5 text-sm font-bold text-black shadow-[0_0_0_0_rgba(217,255,102,0)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e8ff9f] hover:shadow-[0_8px_28px_rgba(217,255,102,0.14)] active:translate-y-0 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4 transition group-hover:scale-110" />}{loading ? "Searching…" : "Search index"}</button>
          </div>
        </div>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-neutral-400">
        <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#d9ff66]" /> Verified open-source licenses · pricing shown separately</span>
        {searched && <div className="flex items-center gap-3"><span className="font-medium tabular-nums text-neutral-300">{items.length} {items.length === 1 ? "project" : "projects"} found</span>{(query || category) && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1.5 text-neutral-400 transition hover:border-[#d9ff66]/30 hover:text-[#d9ff66] active:scale-95"><X className="size-3" /> Clear</button>}</div>}
      </div>

      {searched && (
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="group relative flex min-h-[250px] flex-col rounded-2xl border border-white/[0.09] bg-[#101010] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#d9ff66]/40 hover:bg-[#131313] hover:shadow-[0_16px_44px_rgba(0,0,0,0.28)]">
              <a href={item.website_url || item.source_url} target="_blank" rel="noreferrer" aria-label={`Open ${item.name} official platform`} className="absolute inset-0 z-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d9ff66]"><span className="sr-only">Open {item.name} official platform</span></a>
              <div className="pointer-events-none relative z-10 flex flex-1 flex-col">
              <div className="flex items-start gap-3">
                <SoftwareLogo name={item.name} website={item.website_url} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="truncate text-base font-semibold tracking-tight text-white">{item.name}</h3>
                  <p className="mt-1 truncate text-xs text-neutral-400">{item.license_name}</p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-neutral-600 transition group-hover:text-[#d9ff66]" />
              </div>
              <p className="mt-4 flex-1 text-[13px] leading-6 text-neutral-300">{item.summary}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(item.categories ?? "").split(",").filter(Boolean).slice(0, 2).map((tag) => <span key={tag} className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[10px] text-neutral-400">{tag}</span>)}
                <span className="rounded-md border border-[#d9ff66]/20 bg-[#d9ff66]/[0.06] px-2 py-1 text-[10px] text-[#d9ff66]">{item.pricing_status === "free" ? "Free" : item.pricing_status}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/[0.08] pt-4 text-[11px] font-medium">
                <a href={item.website_url} target="_blank" rel="noreferrer" className="pointer-events-auto relative z-20 text-[#d9ff66] hover:text-white">Website <ExternalLink className="ml-1 inline size-3" /></a>
                <a href={item.source_url} target="_blank" rel="noreferrer" className="pointer-events-auto relative z-20 text-neutral-400 hover:text-white">Source code <ExternalLink className="ml-1 inline size-3" /></a>
                {item.license_url && <a href={item.license_url} target="_blank" rel="noreferrer" className="pointer-events-auto relative z-20 text-neutral-400 hover:text-white">License <ExternalLink className="ml-1 inline size-3" /></a>}
              </div>
              </div>
            </article>
          ))}
          {!loading && items.length === 0 && <div className="col-span-full rounded-2xl border border-white/10 bg-[#101010] p-8 text-center"><p className="text-sm text-neutral-200">{error ? "The catalog could not be reached." : "No matching projects."}</p><p className="mt-2 text-xs text-neutral-500">{error ? "Check your connection and try again." : "Try another name or category."}</p><button type="button" onClick={() => void runSearch()} className="mt-5 rounded-xl border border-[#d9ff66]/30 px-4 py-2.5 text-xs font-semibold text-[#d9ff66] transition hover:bg-[#d9ff66] hover:text-black active:scale-95">Try again</button></div>}
        </div>
      )}
    </div>
  );
}
