import { ArrowUpRight, AudioLines, BookOpen, Braces, Database, Gamepad2, GraduationCap, Layers3, LockKeyhole, MonitorPlay, Palette, Server, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { SoftwareLogo, SoftwareSearch } from "./components/software-search";

const categories = [
  { name: "Development", slug: "development", description: "Editors, APIs and developer tools", icon: Braces },
  { name: "Design & Creative", slug: "creative", description: "Graphics, video, audio and 3D", icon: Palette },
  { name: "Productivity", slug: "productivity", description: "Notes, tasks and collaboration", icon: Layers3 },
  { name: "Privacy & Security", slug: "privacy-security", description: "Privacy, encryption and passwords", icon: LockKeyhole },
  { name: "Self-hosting", slug: "self-hosting", description: "Run your own services", icon: Server },
  { name: "Education", slug: "education", description: "Learning and research tools", icon: GraduationCap },
  { name: "Utilities", slug: "utilities", description: "Files, media and system tools", icon: Wrench },
  { name: "Communication", slug: "communication", description: "Messaging and video meetings", icon: AudioLines },
  { name: "Databases", slug: "databases", description: "SQL, analytics and data stores", icon: Database },
  { name: "Gaming", slug: "gaming", description: "Engines and open games", icon: Gamepad2 },
];

const picks = [
  { name: "Blender", type: "3D creation", website: "https://www.blender.org/", description: "A complete 3D creation suite for modeling, animation and rendering.", platforms: "Windows · macOS · Linux" },
  { name: "Krita", type: "Digital painting", website: "https://krita.org/", description: "A powerful painting application made for illustrators and artists.", platforms: "Windows · macOS · Linux" },
  { name: "Audacity", type: "Audio editing", website: "https://www.audacityteam.org/", description: "Record, edit and process audio with an open-source editor.", platforms: "Windows · macOS · Linux" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#090909]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-10">
          <a href="/" className="flex items-center gap-3">
            <span className="text-lg font-black tracking-[-0.06em]">SENTINEL<span className="text-[#d9ff66]">.</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-neutral-400 md:flex">
            <a className="transition hover:text-white" href="#explore">Categories</a>
            <a className="transition hover:text-white" href="#featured">Featured</a>
            <a className="transition hover:text-white" href="#about">Our standards</a>
          </nav>
          <a href="#search" className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-white transition hover:border-[#d9ff66]/60 hover:text-[#d9ff66]">Explore index <ArrowUpRight className="ml-1 inline size-3.5" /></a>
        </div>
      </header>

      <section className="relative border-b border-white/[0.05]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,255,102,0.09),transparent_55%)]" />
        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-20 text-center sm:pb-24 sm:pt-28 lg:px-10 lg:pt-32">
          <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-[#d9ff66]/20 bg-[#d9ff66]/[0.06] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9ff66]">
            <span className="size-1.5 rounded-full bg-[#d9ff66] shadow-[0_0_12px_#d9ff66]" /> The open software index
          </div>
          <h1 className="mx-auto max-w-5xl text-5xl font-semibold leading-[1.06] tracking-[-0.065em] sm:text-7xl lg:text-[88px]">
            Find the right tool.<br /><span className="text-neutral-500">Keep control.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[15px] leading-7 text-neutral-400 sm:text-lg sm:leading-8">
            Explore carefully selected open-source software. Compare projects, check their licenses and go straight to the official source.
          </p>
          <SoftwareSearch />
          <div className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-neutral-500">
            <span>Open-source first</span><span className="text-neutral-700">/</span><span>License references</span><span className="text-neutral-700">/</span><span>No paid rankings</span>
          </div>
        </div>
      </section>

      <section id="explore" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:py-20 lg:px-10">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9ff66]">Explore the directory</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Browse by category</h2></div>
          <p className="max-w-sm text-sm leading-6 text-neutral-500">Start with what you need. Every category leads to tools you can inspect and compare.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {categories.map((category, index) => {
            const Icon = category.icon;
            return <a key={category.slug} href={`#search`} className="group rounded-2xl border border-white/[0.08] bg-[#101010] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#d9ff66]/35 hover:bg-[#131313]">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-300 transition group-hover:border-[#d9ff66]/25 group-hover:text-[#d9ff66]"><Icon className="size-[18px]" /></span>
                <span className="text-[10px] tabular-nums text-neutral-600">0{index + 1}</span>
              </div>
              <h3 className="mt-6 text-[15px] font-semibold tracking-tight text-neutral-100">{category.name}</h3>
              <p className="mt-2 text-xs leading-5 text-neutral-500">{category.description}</p>
              <div className="mt-5 flex items-center gap-1 text-[11px] font-semibold text-neutral-500 transition group-hover:text-[#d9ff66]">Explore <ArrowUpRight className="size-3.5" /></div>
            </a>;
          })}
        </div>
      </section>

      <section id="featured" className="border-y border-white/[0.05] bg-[#0c0c0c]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:py-20 lg:px-10">
          <div className="mb-8"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9ff66]">Editor's starting point</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Worth discovering</h2></div>
          <div className="grid gap-3 lg:grid-cols-3">
            {picks.map((item) => <article key={item.name} className="rounded-2xl border border-white/[0.08] bg-[#111] p-6 transition hover:border-white/20">
              <div className="flex items-center gap-4">
                <SoftwareLogo name={item.name} website={item.website} />
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{item.type}</p><h3 className="mt-1 text-xl font-semibold tracking-tight">{item.name}</h3></div>
              </div>
              <p className="mt-5 min-h-12 text-sm leading-6 text-neutral-400">{item.description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs text-neutral-500"><span>{item.platforms}</span><a href="#search" className="text-[#d9ff66] hover:text-white">Find it <ArrowUpRight className="ml-1 inline size-3" /></a></div>
            </article>)}
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 lg:px-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-[#101010] p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-[#d9ff66]/[0.045] blur-3xl" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9ff66]"><ShieldCheck className="size-4" /> Our standard</div>
              <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">Open source should be verifiable.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-400">Listings link to an official website, source repository and license reference. Open-source status and pricing are treated separately, so a commercial product is not automatically excluded.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 text-xs font-medium text-neutral-300">
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2"><BookOpen className="size-3.5 text-[#d9ff66]" /> Transparent sources</span>
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2"><Sparkles className="size-3.5 text-[#d9ff66]" /> Curated index</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <span className="font-black tracking-tight text-neutral-200">SENTINEL<span className="text-[#d9ff66]">.</span></span><span>Discover software that stays open.</span><span>© {new Date().getFullYear()} Sentinel</span>
        </div>
      </footer>
    </main>
  );
}
