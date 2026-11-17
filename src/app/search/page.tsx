import Link from "next/link";
import { db } from "@/lib/db";
import { getAvailability, summariseByType, nightsBetween } from "@/lib/availability";
import { quoteStay, zar } from "@/lib/pricing";
import { ROOM_TYPE_LABEL, ROOM_TYPES, type RoomType } from "@/lib/constants";

export const metadata = { title: "Search & Estimate Accommodation · DUT-AMP" };

type Params = {
  checkIn?: string;
  checkOut?: string;
  occupants?: string;
  type?: string;
  residence?: string;
  maxPrice?: string;
  sort?: string;
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const occupants = Math.max(1, Number(sp.occupants) || 1);
  const checkIn = sp.checkIn ? new Date(sp.checkIn) : null;
  const checkOut = sp.checkOut ? new Date(sp.checkOut) : null;
  const valid = checkIn && checkOut && !isNaN(+checkIn) && !isNaN(+checkOut);

  let error: string | null = null;
  if (valid && nightsBetween(checkIn, checkOut) < 1) error = "Check-out must be after check-in.";

  const allResidences = await db.residence.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  type Row = {
    residenceName: string;
    slug: string;
    campus: string | null;
    type: RoomType;
    freeBeds: number;
    pricePerBed: number;
    total: number;
    discount: number;
  };
  const rows: Row[] = [];
  const notes: string[] = [];
  let outsidePeriod = false;

  if (valid && !error) {
    const periods = await db.bookingPeriod.findMany({ where: { isActive: true } });
    outsidePeriod = !periods.some((p) => checkIn >= p.startDate && checkOut <= p.endDate);

    for (const res of allResidences) {
      if (sp.residence && sp.residence !== res.slug) continue;
      const rooms = await getAvailability(res.id, checkIn, checkOut);
      for (const t of summariseByType(rooms)) {
        if (sp.type && sp.type !== t.type) continue;
        if (t.freeBeds < occupants) continue;
        const q = await quoteStay({
          residenceId: res.id,
          roomType: t.type,
          checkIn,
          checkOut,
          occupants,
        });
        if (!q.ok) {
          if (!notes.includes(q.error)) notes.push(q.error);
          continue;
        }
        if (sp.maxPrice && q.pricePerBedPerNight > Number(sp.maxPrice)) continue;
        rows.push({
          residenceName: res.name,
          slug: res.slug,
          campus: res.campus,
          type: t.type as RoomType,
          freeBeds: t.freeBeds,
          pricePerBed: q.pricePerBedPerNight,
          total: q.total,
          discount: q.discountPercent,
        });
      }
    }
    rows.sort((a, b) => (sp.sort === "availability" ? b.freeBeds - a.freeBeds : a.total - b.total));
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] bg-[#112a22] p-8 text-white shadow-md">
        <span className="inline-block rounded-full bg-[#c8f560] px-3.5 py-1 text-xs font-bold text-[#112a22]">
          Live Shared Inventory &amp; Cost Estimator
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Search Accommodation &amp; Estimate Costs</h1>
        <p className="mt-1 text-sm text-neutral-300">
          Filter by residence, room configuration, and price range. Prices update automatically when dates or group size
          change.
        </p>

        {/* Horizontal Viewah Filter Bar */}
        <form className="mt-6 grid gap-3 rounded-[22px] bg-white p-4 text-[#111815] shadow-lg sm:grid-cols-3 lg:grid-cols-8">
          <div>
            <label htmlFor="checkIn" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Check-in
            </label>
            <input
              id="checkIn"
              name="checkIn"
              type="date"
              defaultValue={sp.checkIn ?? "2026-12-05"}
              required
              className="mt-1 w-full rounded-xl border border-neutral-300 px-2.5 py-1.5 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor="checkOut" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Check-out
            </label>
            <input
              id="checkOut"
              name="checkOut"
              type="date"
              defaultValue={sp.checkOut ?? "2026-12-10"}
              required
              className="mt-1 w-full rounded-xl border border-neutral-300 px-2.5 py-1.5 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor="occupants" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Guests
            </label>
            <input
              id="occupants"
              name="occupants"
              type="number"
              min={1}
              defaultValue={occupants}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-2.5 py-1.5 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor="residence" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Residence
            </label>
            <select
              id="residence"
              name="residence"
              defaultValue={sp.residence ?? ""}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-2.5 py-1.5 text-sm font-medium"
            >
              <option value="">All Residences</option>
              {allResidences.map((r) => (
                <option key={r.id} value={r.slug}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Room Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue={sp.type ?? ""}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-2.5 py-1.5 text-sm font-medium"
            >
              <option value="">All Types</option>
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="maxPrice" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Max / Bed / Night
            </label>
            <input
              id="maxPrice"
              name="maxPrice"
              type="number"
              min={0}
              defaultValue={sp.maxPrice}
              placeholder="Any"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-2.5 py-1.5 text-sm font-medium"
            />
          </div>
          <div>
            <label htmlFor="sort" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Sort By
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sp.sort ?? "price"}
              className="mt-1 w-full rounded-xl border border-neutral-300 px-2.5 py-1.5 text-sm font-medium"
            >
              <option value="price">Lowest Price</option>
              <option value="availability">Most Beds Free</option>
            </select>
          </div>
          <div className="self-end">
            <button className="w-full rounded-xl bg-[#112a22] px-4 py-2 text-sm font-bold text-[#c8f560] hover:bg-[#1a3d32]">
              Update →
            </button>
          </div>
        </form>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      {valid && !error && (
        <>
          {outsidePeriod && (
            <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <strong>Seasonal Notice:</strong> These dates fall outside the approved public holiday
              booking windows (June and December). Public holiday bookings cannot be submitted for these dates, but{" "}
              <strong>Institutional Coordinators</strong> may submit year-round delegation requests.
            </div>
          )}
          {notes.map((n) => (
            <p key={n} role="status" className="text-sm text-amber-800">{n}</p>
          ))}

          {rows.length === 0 ? (
            <div className="rounded-[28px] border border-black/5 bg-white p-10 text-center text-neutral-600">
              No accommodation options match {occupants} occupant{occupants === 1 ? "" : "s"} for the selected filters.
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {rows.map((r) => (
                <li
                  key={`${r.slug}-${r.type}`}
                  className="flex flex-col justify-between gap-4 rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#e6ece8] px-3 py-0.5 text-xs font-bold text-[#112a22]">
                        {r.campus ?? "Durban"} Campus
                      </span>
                      <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                        {r.freeBeds} beds available
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-[#112a22]">
                      <Link className="hover:underline" href={`/residences/${r.slug}`}>
                        {r.residenceName}
                      </Link>
                    </h2>
                    <p className="text-sm text-neutral-600">
                      <strong>{ROOM_TYPE_LABEL[r.type]}</strong> · {zar(r.pricePerBed)} per bed / night
                      {r.discount > 0 && (
                        <span className="ml-2 rounded-full bg-[#c8f560] px-2.5 py-0.5 text-xs font-bold text-[#112a22]">
                          {r.discount}% Group Discount Applied
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-end justify-between border-t border-neutral-100 pt-4">
                    <div>
                      <p className="text-xs text-neutral-500">
                        Estimated total ({nightsBetween(checkIn!, checkOut!)} nights × {occupants} guest{occupants === 1 ? "" : "s"})
                      </p>
                      <p className="text-2xl font-extrabold text-[#112a22]">{zar(r.total)}</p>
                    </div>
                    <Link
                      href={`/book?residence=${r.slug}&type=${r.type}&checkIn=${sp.checkIn}&checkOut=${sp.checkOut}&occupants=${occupants}`}
                      className="rounded-full bg-[#112a22] px-5 py-2.5 text-xs font-bold text-[#c8f560] shadow hover:bg-[#1a3d32] transition"
                    >
                      Book Stay ↗
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
