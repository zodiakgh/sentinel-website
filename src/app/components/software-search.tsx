"use client";

import { Search, ArrowUpRight, ExternalLink } from "lucide-react";
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

export function SoftwareSearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<Software[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      const response = await fetch(`/api/software?${params.toString()}`);
      const data = await response.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void search(); }, []);

  return (
    <div id="search" className="mx-auto mt-10 max-w-5xl">
      <form onSubmit={search} className="flex flex-col gap-2 rounded-2xl border border-neutral-700 bg-[#111] p-2 text-left shadow-2xl shadow-black/40 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-3">
        <Search className="ml-3 size-5 shrink-0 text-neutral-500" />
          <input aria-label="Search software" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search open-source software..." className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-white outline-none placeholder:text-neutral-600" />
        </div>
        <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-neutral-800 bg-[#171717] px-3 py-3 text-sm text-neutral-300 outline-none">
          <option value="">All categories</option>
          <option value="development">Development</option>
          <option value="creative">Design &amp; Creative</option>
          <option value="productivity">Productivity</option>
          <option value="privacy-security">Privacy &amp; Security</option>
          <option value="self-hosting">Self-hosting</option>
          <option value="education">Education</option>
          <option value="utilities">Utilities</option>
          <option value="communication">Communication</option>
          <option value="databases">Databases</option>
          <option value="gaming">Gaming</option>
        </select>
        <button disabled={loading} className="rounded-xl bg-[#d9ff66] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#e5ff9a] disabled:opacity-60">{loading ? "Searching..." : "Search"}</button>
      </form>
      <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
        <span>Verified open-source licenses · free to download or self-host</span>
        {searched && <span>{items.length} results</span>}
      </div>
      {searched && (
        <div className="mt-4 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-neutral-800 bg-[#101010] p-5 transition hover:border-neutral-600">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-lg font-semibold">{item.name}</h3><p className="mt-1 text-xs text-neutral-500">{item.license_name} · {item.spdx_id}</p></div>
                <ArrowUpRight className="size-4 shrink-0 text-neutral-500" />
              </div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-neutral-400">{item.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                {(item.categories ?? "").split(",").filter(Boolean).map((category) => <span key={category} className="rounded-full border border-neutral-800 px-2 py-1">{category}</span>)}
                <span className="rounded-full border border-neutral-800 px-2 py-1">{item.pricing_status === "free" ? "Free download" : item.pricing_status}</span>
              </div>
              <div className="mt-5 flex gap-4 border-t border-neutral-800 pt-4 text-xs">
                <a href={item.website_url} target="_blank" rel="noreferrer" className="text-[#d9ff66] hover:underline">Official website <ExternalLink className="ml-1 inline size-3" /></a>
                <a href={item.source_url} target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white">Source code <ExternalLink className="ml-1 inline size-3" /></a>
                {item.license_url && <a href={item.license_url} target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white">License <ExternalLink className="ml-1 inline size-3" /></a>}
              </div>
            </article>
          ))}
          {!loading && items.length === 0 && <p className="col-span-full rounded-xl border border-neutral-800 p-5 text-sm text-neutral-500">No verified software found yet.</p>}
        </div>
      )}
    </div>
  );
}
