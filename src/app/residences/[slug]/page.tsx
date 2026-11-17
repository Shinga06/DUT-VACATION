import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ROOM_TYPE_LABEL, type RoomType } from "@/lib/constants";
import { zar } from "@/lib/pricing";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import QuickQuoteCard from "@/components/QuickQuoteCard";

const RESIDENCE_IMAGES: Record<string, string> = {
  ritson:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85",
  "steve-biko":
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=85",
  "ml-sultan":
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1600&q=85",
};

export default async function ResidenceDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const residence = await db.residence.findUnique({
    where: { slug },
    include: { rooms: { where: { isActive: true } } },
  });
  if (!residence || !residence.isActive) notFound();

  const rules = await db.pricingRule.findMany({
    where: { isActive: true, OR: [{ residenceId: null }, { residenceId: residence.id }] },
    orderBy: { pricePerBedPerNight: "asc" },
  });

  const counts = residence.rooms.reduce<Record<string, { rooms: number; beds: number }>>((acc, r) => {
    acc[r.type] ??= { rooms: 0, beds: 0 };
    acc[r.type].rooms += 1;
    acc[r.type].beds += r.capacity;
    return acc;
  }, {});

  const img =
    residence.photos.split(",").map((s) => s.trim()).find(Boolean) ??
    RESIDENCE_IMAGES[residence.slug] ??
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85";

  return (
    <div className="space-y-10">
      {/* Scenic Viewah Residence Banner */}
      <header className="relative overflow-hidden rounded-[32px] bg-[#112a22] text-white shadow-xl">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${img}')` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#091913]/95 via-[#0b1f18]/65 to-[#0b1f18]/35"
        />
        <div className="relative z-10 flex min-h-[340px] flex-col justify-between p-8 sm:p-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href="/residences"
              className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/25 transition"
            >
              ← All Residences
            </Link>
            <span className="rounded-full bg-[#c8f560] px-3.5 py-1 text-xs font-bold text-[#112a22]">
              {residence.campus ?? "Durban"} Campus
            </span>
          </div>

          <div className="mt-16 flex flex-wrap items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">{residence.name}</h1>
              <p className="text-sm text-neutral-200/90">{residence.address}</p>
              <p className="text-sm sm:text-base text-neutral-100 leading-relaxed pt-1">{residence.description}</p>
            </div>
            <Link
              href={`/search?residence=${residence.slug}&checkIn=2026-12-05&checkOut=2026-12-10&occupants=1`}
              className="rounded-full bg-[#c8f560] px-6 py-3.5 text-sm font-bold text-[#112a22] shadow-lg hover:bg-[#d5f880] transition"
            >
              Search &amp; Book This Residence →
            </Link>
          </div>
        </div>
      </header>

      {/* Facilities & Room Configurations Bento Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section aria-labelledby="fac" className="lg:col-span-5 rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
          <h2 id="fac" className="text-xl font-semibold text-[#112a22]">Facilities &amp; Amenities</h2>
          <ul className="flex flex-wrap gap-2">
            {residence.facilities.split(",").filter(Boolean).map((f) => (
              <li
                key={f}
                className="rounded-full bg-[#e6ece8] px-4 py-1.5 text-xs font-semibold text-[#112a22]"
              >
                ✦ {f}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="types" className="lg:col-span-7 rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
          <h2 id="types" className="text-xl font-semibold text-[#112a22]">Accommodation Configurations</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {Object.entries(counts).map(([type, c]) => (
              <li key={type} className="rounded-2xl bg-[#f6f7f3] p-4 border border-neutral-200/60">
                <p className="font-bold text-[#112a22]">{ROOM_TYPE_LABEL[type as RoomType] ?? type}</p>
                <p className="text-xs text-neutral-600 mt-1">{c.rooms} rooms · {c.beds} configurable beds</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Pricing Table */}
      <section aria-labelledby="prices" className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
        <h2 id="prices" className="text-xl font-semibold text-[#112a22]">Applicable Rates (Per Bed, Per Night)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Applicable accommodation rates</caption>
            <thead className="bg-[#f6f7f3]">
              <tr>
                <th scope="col" className="p-3 rounded-l-xl">Rate Plan</th>
                <th scope="col" className="p-3">Room Type</th>
                <th scope="col" className="p-3">Season</th>
                <th scope="col" className="p-3">Conditions &amp; Group Discounts</th>
                <th scope="col" className="p-3 rounded-r-xl text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="p-3 font-medium text-[#112a22]">{r.name}</td>
                  <td className="p-3">{r.roomType ? ROOM_TYPE_LABEL[r.roomType as RoomType] : "All Types"}</td>
                  <td className="p-3">{r.season ?? "Year-round"}</td>
                  <td className="p-3 text-xs text-neutral-600">
                    {r.minNights ? `Min ${r.minNights} night(s)` : "Flexible stay"}{" "}
                    {r.maxNights ? `· Max ${r.maxNights} nights` : ""}
                    {r.minGroupSize ? ` · ${r.discountPercent}% off for ${r.minGroupSize}+ guests` : ""}
                  </td>
                  <td className="p-3 text-right font-bold text-[#112a22]">{zar(r.pricePerBedPerNight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Interactive Availability Calendar & Live Quick Quote Sidebar */}
      <section aria-labelledby="cal" className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8 space-y-3">
          <h2 id="cal" className="text-xl font-semibold text-[#112a22]">Live Interactive Availability Calendar</h2>
          <AvailabilityCalendar residenceId={residence.id} />
        </div>
        <div className="lg:col-span-4 lg:mt-10">
          <QuickQuoteCard residenceSlug={residence.slug} rules={rules} />
        </div>
      </section>
    </div>
  );
}
