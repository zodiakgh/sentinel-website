import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";
import { SoftwareSearch } from "./components/software-search";

const categories = [
  { name: "Development", count: "Code editors, APIs, databases" },
  { name: "Design & Creative", count: "Image, video, audio and 3D" },
  { name: "Productivity", count: "Notes, tasks and collaboration" },
  { name: "Privacy & Security", count: "Browsers, password managers and privacy" },
  { name: "Self-hosting", count: "Run your own services" },
  { name: "Education", count: "Learning and research tools" },
];

const picks = [
  { name: "Blender", type: "3D creation", platforms: "Windows · macOS · Linux", description: "A complete 3D creation suite for modeling, animation, rendering and more." },
  { name: "Krita", type: "Digital painting", platforms: "Windows · macOS · Linux", description: "A professional painting application built for illustrators and concept artists." },
  { name: "Audacity", type: "Audio editing", platforms: "Windows · macOS · Linux", description: "Record, edit and process audio with a powerful open-source editor." },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <a href="/" className="text-xl font-black tracking-[-0.07em]">SENTINEL<span className="text-[#d9ff66]">.</span></a>
        <nav className="hidden items-center gap-8 text-sm text-neutral-400 md:flex">
          <a className="transition hover:text-white" href="#explore">Explore</a>
          <a className="transition hover:text-white" href="#featured">Featured</a>
          <a className="transition hover:text-white" href="#about">Our standards</a>
        </nav>
        <a href="#explore" className="rounded-full border border-neutral-700 px-4 py-2 text-sm transition hover:border-neutral-400">Explore software <ArrowUpRight className="ml-1 inline size-4" /></a>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-24 pt-20 text-center lg:px-10 lg:pt-28">
        <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-xs text-neutral-300">
          <span className="size-1.5 rounded-full bg-[#d9ff66]" /> THE OPEN SOFTWARE INDEX
        </div>
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold leading-[1.04] tracking-[-0.065em] sm:text-7xl lg:text-8xl">
          Find software.<br /><span className="text-neutral-500">Not subscriptions.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-neutral-400 sm:text-lg">
          A carefully curated directory of free and open-source software. Discover tools that respect your freedom and your budget.
        </p>
        <SoftwareSearch />
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-neutral-500">
          <span>Popular:</span><span>Photoshop alternatives</span><span>·</span><span>Private browsers</span><span>·</span><span>Self-hosted tools</span>
        </div>
      </section>

      <section id="explore" className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9ff66]">Browse the index</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Explore by category</h2></div>
          <span className="hidden text-sm text-neutral-500 sm:block">A better tool for every workflow.</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <a key={category.name} href="#" className="group rounded-2xl border border-neutral-800 bg-[#101010] p-6 transition hover:-translate-y-0.5 hover:border-neutral-600">
              <div className="mb-8 flex items-center justify-between"><span className="text-xs text-neutral-600">0{index + 1}</span><ArrowUpRight className="size-4 text-neutral-600 transition group-hover:text-[#d9ff66]" /></div>
              <h3 className="text-lg font-medium">{category.name}</h3><p className="mt-2 text-sm text-neutral-500">{category.count}</p>
            </a>
          ))}
        </div>
      </section>

      <section id="featured" className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9ff66]">A place to start</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Worth discovering</h2></div>
        <div className="grid gap-3 lg:grid-cols-3">
          {picks.map((item) => (
            <article key={item.name} className="rounded-2xl border border-neutral-800 bg-[#101010] p-6">
              <div className="mb-6 flex items-center justify-between"><span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400">Open source · Free</span><ArrowUpRight className="size-4 text-neutral-600" /></div>
              <p className="text-xs uppercase tracking-wider text-neutral-500">{item.type}</p><h3 className="mt-2 text-2xl font-semibold">{item.name}</h3>
              <p className="mt-3 min-h-12 text-sm leading-6 text-neutral-400">{item.description}</p>
              <p className="mt-6 border-t border-neutral-800 pt-4 text-xs text-neutral-500">{item.platforms}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="flex flex-col justify-between gap-8 rounded-3xl border border-neutral-800 bg-[#101010] p-8 sm:p-12 lg:flex-row lg:items-center">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#d9ff66]"><ShieldCheck className="size-4" /> Our standard</div><h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Free should mean free.<br />Open should mean open.</h2><p className="mt-4 max-w-xl leading-7 text-neutral-400">Every listing is expected to meet clear criteria. We distinguish genuinely free software from limited free tiers, and verify open-source licenses against recognized sources.</p></div>
          <div className="flex items-center gap-3 text-sm text-neutral-400"><Sparkles className="size-5 text-[#d9ff66]" /> Independent. Transparent. Curated.</div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-neutral-900 px-6 py-8 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <span className="font-bold tracking-tight text-neutral-300">SENTINEL.</span><span>Discover software that stays open.</span><span>© {new Date().getFullYear()} Sentinel</span>
      </footer>
    </main>
  );
}
