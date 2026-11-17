import Link from "next/link";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=2000&q=85";

const RESIDENCE_IMAGES: Record<string, string> = {
  ritson:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  "steve-biko":
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
  "ml-sultan":
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
};

export default async function Home() {
  const [residences, periods, minRule] = await Promise.all([
    db.residence.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { rooms: { where: { isActive: true } } },
    }),
    db.bookingPeriod.findMany({ where: { isActive: true }, orderBy: { startDate: "asc" } }),
    db.pricingRule.findFirst({ where: { isActive: true }, orderBy: { pricePerBedPerNight: "asc" } }),
  ]);

  const totalRooms = residences.reduce((s, r) => s + r.rooms.length, 0);
  const totalBeds = residences.reduce((s, r) => s + r.rooms.reduce((b, rm) => b + rm.capacity, 0), 0);
  const defaultCheckIn = "2026-12-05";
  const defaultCheckOut = "2026-12-10";

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* ────────────────── VIEWAH-STYLE IMMERSIVE HERO SECTION ────────────────── */}
      <section className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] bg-[#0e231c] text-white shadow-[0_24px_60px_rgba(17,42,34,0.18)]">
        {/* Scenic Architectural & Lush Greenery Backdrop */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700"
          style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
        />
        {/* Multi-Stop Organic Emerald & Charcoal Scrim for Crisp Typography */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-[#0b1f18]/80 via-[#0b1f18]/60 to-[#091913]/95"
        />

        <div className="relative z-10 flex min-h-[540px] sm:min-h-[600px] flex-col justify-between p-5 sm:p-10 lg:p-14">
          {/* Top Hero Content Row */}
          <div className="grid gap-6 sm:gap-8 lg:grid-cols-12 lg:items-start pt-1 sm:pt-2">
            {/* Left Editorial Headline & Value Prop */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] sm:text-xs font-medium tracking-wide text-white backdrop-blur-md">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#c8f560]" />
                <span className="truncate">Durban University of Technology · Official Stay &amp; Delegation Portal</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.08] text-white">
                Find Your Serene University Stay in <span className="text-[#c8f560]">Durban</span>
              </h1>

              <p className="max-w-xl text-sm sm:text-lg text-neutral-200/90 leading-relaxed font-normal">
                Experience tranquil, secure campus residences and boutique guest houses across Berea and Musgrave—crafted
                for June &amp; December holiday guests and year-round visiting academic delegations.
              </p>

              {/* Pill Highlights */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] sm:text-xs font-medium">
                <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-md">
                  ✦ {residences.length} Curated Residences
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-md">
                  ✦ {totalBeds} Configurable Beds
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-md">
                  ✦ Instant Online &amp; EFT Verification
                </span>
                <span className="rounded-full bg-[#c8f560]/20 border border-[#c8f560]/40 text-[#c8f560] px-3 py-1.5 backdrop-blur-md">
                  ✦ 10% Group Discount (10+ Guests)
                </span>
              </div>
            </div>

            {/* Right Floating Glass Preview Card (Signature Viewah Detail) */}
            <div className="lg:col-span-4 lg:justify-self-end">
              <div className="w-full sm:max-w-xs rounded-3xl border border-white/20 bg-white/12 p-4 sm:p-5 text-white shadow-2xl backdrop-blur-xl space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#c8f560] px-3 py-1 text-[11px] font-bold text-[#112a22]">
                    Featured Residence
                  </span>
                  <span className="text-xs font-semibold text-amber-300">★ 4.9 (Guest Rated)</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold">ML Sultan Guest House</h2>
                  <p className="text-xs text-neutral-200/80">Centenary Road · Botanical &amp; City Precinct</p>
                </div>
                <div className="flex items-end justify-between border-t border-white/15 pt-3">
                  <div>
                    <p className="text-[11px] text-neutral-300">Rates starting from</p>
                    <p className="text-xl sm:text-2xl font-bold text-[#c8f560]">
                      {minRule ? zar(minRule.pricePerBedPerNight) : "R200"}
                      <span className="text-xs font-normal text-neutral-200"> / bed / night</span>
                    </p>
                  </div>
                  <Link
                    href="/residences/ml-sultan"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#112a22] font-bold hover:bg-[#c8f560] transition"
                    aria-label="Explore ML Sultan Guest House"
                  >
                    ↗
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ────────────────── DOCKED HORIZONTAL VIEWAH BOOKING BAR ────────────────── */}
          <div className="mt-8 sm:mt-10">
            {/* Category Filter Pills Above Search Bar (Swipeable on Mobile) */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="-mx-1 flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full bg-black/35 p-1.5 backdrop-blur-md border border-white/15 text-xs font-medium no-scrollbar">
                <span className="shrink-0 rounded-full bg-white px-4 py-1.5 font-semibold text-[#112a22]">
                  All Stays
                </span>
                <Link
                  href="/search?checkIn=2026-12-05&checkOut=2026-12-10&occupants=1"
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-white/90 hover:bg-white/10 transition"
                >
                  Holiday (June &amp; Dec)
                </Link>
                <Link
                  href="/register"
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-white/90 hover:bg-white/10 transition"
                >
                  Institutional Delegations
                </Link>
                <Link
                  href="/search?checkIn=2026-12-05&checkOut=2026-12-10&occupants=10&type=SHARING"
                  className="shrink-0 rounded-full px-3.5 py-1.5 text-white/90 hover:bg-white/10 transition"
                >
                  Group Bookings (10+)
                </Link>
              </div>
              <span className="hidden md:inline text-xs text-neutral-200/90 shrink-0">
                Real-time shared inventory · Instant cost estimation
              </span>
            </div>

            {/* White Horizontal Multi-Column Search & Cost Widget */}
            <form
              action="/search"
              className="grid gap-2 sm:gap-3 rounded-[22px] sm:rounded-[24px] bg-white p-3.5 sm:p-4 text-[#111815] shadow-2xl divide-y divide-neutral-100 sm:divide-y-0 sm:grid-cols-2 lg:grid-cols-12 lg:items-center"
            >
              {/* 1. Location / Residence */}
              <div className="lg:col-span-3 rounded-2xl px-2 sm:px-3.5 py-1.5 sm:py-2 hover:bg-neutral-50 transition">
                <label htmlFor="residence" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Location / Residence
                </label>
                <select
                  id="residence"
                  name="residence"
                  defaultValue=""
                  className="mt-0.5 w-full border-0 bg-transparent p-0 text-sm font-semibold text-[#112a22] focus:ring-0"
                >
                  <option value="">All Durban Campuses</option>
                  {residences.map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Check-in Date & 3. Check-out Date (Side-by-side on mobile too!) */}
              <div className="grid grid-cols-2 gap-2 pt-2 sm:pt-0 sm:col-span-2 lg:col-span-4 lg:border-l lg:border-neutral-200">
                <div className="rounded-2xl px-2 sm:px-3.5 py-1 sm:py-2 hover:bg-neutral-50 transition">
                  <label htmlFor="checkIn" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Check-in
                  </label>
                  <input
                    id="checkIn"
                    name="checkIn"
                    type="date"
                    defaultValue={defaultCheckIn}
                    required
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-xs sm:text-sm font-semibold text-[#112a22] focus:ring-0"
                  />
                </div>
                <div className="rounded-2xl px-2 sm:px-3.5 py-1 sm:py-2 hover:bg-neutral-50 transition border-l border-neutral-100 lg:border-neutral-200">
                  <label htmlFor="checkOut" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Check-out
                  </label>
                  <input
                    id="checkOut"
                    name="checkOut"
                    type="date"
                    defaultValue={defaultCheckOut}
                    required
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-xs sm:text-sm font-semibold text-[#112a22] focus:ring-0"
                  />
                </div>
              </div>

              {/* 4. Room Type & Guests */}
              <div className="lg:col-span-3 grid grid-cols-2 gap-2 rounded-2xl px-2 sm:px-3.5 pt-2 sm:pt-2 pb-1 sm:pb-2 hover:bg-neutral-50 transition lg:border-l lg:border-neutral-200">
                <div>
                  <label htmlFor="type" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Room Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    defaultValue=""
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-xs sm:text-sm font-semibold text-[#112a22] focus:ring-0"
                  >
                    <option value="">Any Type</option>
                    <option value="SINGLE">Single</option>
                    <option value="DOUBLE">Double</option>
                    <option value="SHARING">Sharing</option>
                  </select>
                </div>
                <div className="border-l border-neutral-100 pl-2 sm:border-0 sm:pl-0">
                  <label htmlFor="occupants" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    Guests
                  </label>
                  <input
                    id="occupants"
                    name="occupants"
                    type="number"
                    min={1}
                    defaultValue={1}
                    required
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-xs sm:text-sm font-semibold text-[#112a22] focus:ring-0"
                  />
                </div>
              </div>

              {/* 5. Search Action Pill */}
              <div className="pt-2 sm:pt-0 sm:col-span-2 lg:col-span-2">
                <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#112a22] px-5 py-3.5 sm:py-4 text-sm font-bold text-[#c8f560] shadow-md hover:bg-[#1a3d32] transition">
                  <span>Search Availability</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ────────────────── CURATED RESIDENCE BENTO CARDS ────────────────── */}
      <section aria-labelledby="res" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-1 text-xs font-semibold text-[#112a22]">
              Explore Our Spaces
            </span>
            <h2 id="res" className="text-3xl font-semibold tracking-tight text-[#112a22]">
              Handpicked University Residences &amp; Guest Lodges
            </h2>
          </div>
          <Link
            href="/residences"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#112a22] hover:bg-neutral-100 transition"
          >
            <span>View all {totalRooms} rooms</span>
            <span>↗</span>
          </Link>
        </div>

        <ul className="grid gap-6 md:grid-cols-3">
          {residences.map((r) => {
            const beds = r.rooms.reduce((s, rm) => s + rm.capacity, 0);
            const facilities = r.facilities.split(",").filter(Boolean);
            const img =
              r.photos.split(",").map((s) => s.trim()).find(Boolean) ??
              RESIDENCE_IMAGES[r.slug] ??
              "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80";

            return (
              <li
                key={r.id}
                className="group flex flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition"
              >
                {/* Scenic Image Header with Floating Glass Badges */}
                <div className="relative h-56 w-full overflow-hidden rounded-[22px] bg-neutral-200">
                  <div
                    className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url('${img}')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#112a22] backdrop-blur-md">
                      {r.campus ?? "Durban"} Campus
                    </span>
                  </div>
                  <div className="absolute right-3 top-3">
                    <span className="rounded-full bg-[#112a22]/90 px-3 py-1 text-xs font-bold text-[#c8f560] backdrop-blur-md">
                      {r.rooms.length} Rooms · {beds} Beds
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                    <span className="text-xs font-medium text-white/90">{r.address}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-4 space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xl font-bold text-[#112a22]">{r.name}</h3>
                    </div>
                    <p className="text-sm text-neutral-600 leading-relaxed">{r.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {facilities.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-[#f2f4ef] px-3 py-1 text-xs font-medium text-neutral-700"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium">Interactive Calendar</p>
                      <Link
                        className="text-sm font-bold text-[#112a22] hover:underline"
                        href={`/residences/${r.slug}`}
                      >
                        View dates &amp; rates →
                      </Link>
                    </div>
                    <Link
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#112a22] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a3d32] transition"
                      href={`/search?residence=${r.slug}&checkIn=${defaultCheckIn}&checkOut=${defaultCheckOut}&occupants=1`}
                    >
                      <span>Book now</span>
                      <span>↗</span>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ────────────────── EDITORIAL BENTO: SEASONAL & INSTITUTIONAL STAYS ────────────────── */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-[28px] bg-[#112a22] p-8 sm:p-10 text-white flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="inline-block rounded-full bg-[#c8f560] px-3.5 py-1 text-xs font-bold text-[#112a22]">
              Year-Round Institutional Delegations
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Hosting an Academic Summit, Sports Tournament, or Visiting Delegation?
            </h2>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
              Institutional coordinators can submit accommodation requests any time of the year, upload delegate rosters
              in bulk via CSV, set individual delegate arrival/departure dates, and generate official confirmation
              letters.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/register"
              className="rounded-full bg-[#c8f560] px-6 py-3 text-sm font-bold text-[#112a22] hover:bg-[#d5f880] transition"
            >
              Register as Coordinator →
            </Link>
            <Link
              href="/search"
              className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Estimate Group Rates
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-[28px] border border-black/5 bg-white p-8 flex flex-col justify-between space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <div className="space-y-3">
            <span className="inline-block rounded-full bg-[#f2f4ef] px-3.5 py-1 text-xs font-bold text-[#112a22]">
              Public Holiday Windows
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-[#112a22]">
              June &amp; December Vacation Bookings
            </h2>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Public holiday guests enjoy affordable self-catering stays with automatic booking confirmation once online
              or verified EFT payment is completed.
            </p>
          </div>

          {periods.length > 0 && (
            <ul className="space-y-2.5">
              {periods.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl bg-[#f6f7f3] px-4 py-3 text-xs"
                >
                  <span className="font-bold text-[#112a22]">{p.name}</span>
                  <span className="font-medium text-neutral-600">
                    {p.startDate.toLocaleDateString("en-ZA")} – {p.endDate.toLocaleDateString("en-ZA")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
