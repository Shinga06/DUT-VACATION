import Link from "next/link";
import { db } from "@/lib/db";
import { ROOM_TYPE_LABEL, type RoomType } from "@/lib/constants";

export const metadata = { title: "Residences & Guest Accommodation · DUT-AMP" };

const RESIDENCE_IMAGES: Record<string, string> = {
  ritson:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  "steve-biko":
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
  "ml-sultan":
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
};

export default async function ResidencesPage() {
  const residences = await db.residence.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { rooms: { where: { isActive: true } } },
  });

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] bg-[#112a22] p-8 sm:p-10 text-white shadow-md">
        <span className="inline-block rounded-full bg-[#c8f560] px-3.5 py-1 text-xs font-bold text-[#112a22]">
          Durban University of Technology · Catalogue
        </span>
        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
          Participating Residences &amp; Guest Facilities
        </h1>
        <p className="mt-2 max-w-2xl text-sm sm:text-base text-neutral-300">
          Explore our university-managed residences and guest houses across Durban. Select any facility to inspect room
          configurations, seasonal pricing, and the live interactive availability calendar.
        </p>
      </div>

      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {residences.map((r) => {
          const types = [...new Set(r.rooms.map((x) => x.type))];
          const totalBeds = r.rooms.reduce((s, rm) => s + rm.capacity, 0);
          const facilities = r.facilities.split(",").filter(Boolean);
          const img =
            r.photos.split(",").map((s) => s.trim()).find(Boolean) ??
            RESIDENCE_IMAGES[r.slug] ??
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80";

          return (
            <li
              key={r.id}
              className="group flex flex-col justify-between overflow-hidden rounded-[28px] border border-black/5 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.08)] transition"
            >
              <div>
                <div className="relative h-52 w-full overflow-hidden rounded-[22px] bg-neutral-200">
                  <div
                    className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url('${img}')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#112a22] backdrop-blur-md">
                    {r.campus ?? "Durban"} Campus
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-[#112a22]/90 px-3 py-1 text-xs font-bold text-[#c8f560] backdrop-blur-md">
                    {r.rooms.length} Rooms · {totalBeds} Beds
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <h2 className="text-xl font-bold text-[#112a22]">
                    <Link className="hover:underline" href={`/residences/${r.slug}`}>
                      {r.name}
                    </Link>
                  </h2>
                  <p className="text-xs text-neutral-500">{r.address}</p>
                  <p className="text-sm text-neutral-600 leading-relaxed">{r.description}</p>

                  <div className="pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Room Types
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {types.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-[#e6ece8] px-3 py-0.5 text-xs font-semibold text-[#112a22]"
                        >
                          {ROOM_TYPE_LABEL[t as RoomType] ?? t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                      Amenities
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {facilities.map((f) => (
                        <span key={f} className="rounded-full bg-[#f2f4ef] px-2.5 py-0.5 text-xs text-neutral-700">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mx-4 mb-2 flex items-center justify-between border-t border-neutral-100 pt-4">
                <Link
                  className="text-sm font-bold text-[#112a22] hover:underline"
                  href={`/residences/${r.slug}`}
                >
                  Calendar &amp; Pricing →
                </Link>
                <Link
                  className="rounded-full bg-[#112a22] px-4 py-2 text-xs font-bold text-[#c8f560] hover:bg-[#1a3d32]"
                  href={`/search?residence=${r.slug}&checkIn=2026-12-05&checkOut=2026-12-10&occupants=1`}
                >
                  Check Availability
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
