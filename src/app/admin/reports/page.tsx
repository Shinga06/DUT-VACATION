import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";
import { markFeedbackReviewed } from "@/app/actions/admin";

export const metadata = { title: "Reports, Analytics & Feedback · Admin · DUT-AMP" };

type ReportParams = {
  from?: string;
  to?: string;
  residenceId?: string;
  category?: string;
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  await requirePermission("dashboard.view");
  const sp = await searchParams;

  const fromDate = sp.from ? new Date(sp.from) : null;
  const toDate = sp.to ? new Date(`${sp.to}T23:59:59`) : null;

  const bookingWhere = {
    ...(sp.residenceId ? { residenceId: sp.residenceId } : {}),
    ...(sp.category ? { type: sp.category } : {}),
    ...(fromDate || toDate
      ? {
          checkIn: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const [allResidences, residences, bookings, feedbacks] = await Promise.all([
    db.residence.findMany({ orderBy: { name: "asc" } }),
    db.residence.findMany({
      where: sp.residenceId ? { id: sp.residenceId } : {},
      orderBy: { name: "asc" },
      include: {
        rooms: { include: { beds: true } },
        bookings: {
          where: {
            status: { notIn: ["CANCELLED", "REJECTED"] },
            ...(sp.category ? { type: sp.category } : {}),
            ...(fromDate || toDate
              ? {
                  checkIn: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lte: toDate } : {}),
                  },
                }
              : {}),
          },
        },
      },
    }),
    db.booking.findMany({
      where: bookingWhere,
      orderBy: { createdAt: "desc" },
    }),
    db.feedback.findMany({
      where: sp.residenceId ? { booking: { residenceId: sp.residenceId } } : {},
      orderBy: { createdAt: "desc" },
      include: { booking: { include: { residence: true, user: true } } },
    }),
  ]);

  const activeBookings = bookings.filter((b) => !["CANCELLED", "REJECTED"].includes(b.status));
  const actualRevenue = bookings.reduce((s, b) => s + b.amountPaid, 0);
  const pipelineForecast = activeBookings.reduce((s, b) => s + b.agreedTotal, 0);
  const outstanding = Math.max(0, pipelineForecast - actualRevenue);

  const publicCount = activeBookings.filter((b) => b.type === "PUBLIC").length;
  const instCount = activeBookings.filter((b) => b.type === "INSTITUTIONAL").length;

  const filterQs = new URLSearchParams(
    Object.entries({
      from: sp.from ?? "",
      to: sp.to ?? "",
      residenceId: sp.residenceId ?? "",
      category: sp.category ?? "",
    }).filter(([, v]) => Boolean(v)),
  ).toString();
  const qsSuffix = filterQs ? `&${filterQs}` : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#112a22]">Reporting, Analytics &amp; Guest Feedback</h1>
          <p className="text-xs text-neutral-500">
            Filter occupancy, verified vs. forecasted revenue, and export filtered CSV datasets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href={`/api/export?kind=bookings${qsSuffix}`}
            className="rounded-full bg-[#112a22] px-4 py-2 font-bold text-[#c8f560] hover:bg-[#1a3d32]"
          >
            Export Filtered Bookings CSV
          </a>
          <a
            href={`/api/export?kind=finance${qsSuffix}`}
            className="rounded-full bg-emerald-800 px-4 py-2 font-bold text-white hover:bg-emerald-700"
          >
            Export Filtered Finance CSV
          </a>
          <a
            href="/api/export?kind=audit"
            className="rounded-full border border-neutral-300 bg-white px-4 py-2 font-bold text-[#112a22] hover:bg-neutral-50"
          >
            Export Audit Log CSV
          </a>
        </div>
      </div>

      {/* Interactive Report Filter Bar */}
      <form className="grid gap-3 rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="rp-from" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Check-in From
          </label>
          <input
            id="rp-from"
            name="from"
            type="date"
            defaultValue={sp.from ?? ""}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="rp-to" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Check-in To
          </label>
          <input
            id="rp-to"
            name="to"
            type="date"
            defaultValue={sp.to ?? ""}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="rp-res" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Residence
          </label>
          <select
            id="rp-res"
            name="residenceId"
            defaultValue={sp.residenceId ?? ""}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">All Residences</option>
            {allResidences.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rp-cat" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Booking Category
          </label>
          <select
            id="rp-cat"
            name="category"
            defaultValue={sp.category ?? ""}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            <option value="PUBLIC">Public Holiday</option>
            <option value="INSTITUTIONAL">Institutional Delegation</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className="flex-1 rounded-full bg-[#112a22] px-4 py-2 text-xs font-bold text-[#c8f560] hover:bg-[#1a3d32]">
            Apply Filters
          </button>
          {filterQs && (
            <Link
              href="/admin/reports"
              className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              Reset
            </Link>
          )}
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-medium text-neutral-500">Actual Verified Revenue</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{zar(actualRevenue)}</p>
        </div>
        <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-medium text-neutral-500">Forecasted Revenue (Historical/Pipeline)</p>
          <p className="mt-1 text-2xl font-extrabold text-[#112a22]">{zar(pipelineForecast)}</p>
          <p className="text-[11px] text-neutral-500">Distinguished from actual verified revenue</p>
        </div>
        <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-medium text-neutral-500">Outstanding Balances</p>
          <p className="mt-1 text-2xl font-extrabold text-red-700">{zar(outstanding)}</p>
        </div>
        <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-medium text-neutral-500">Seasonal vs Institutional</p>
          <p className="mt-1 text-lg font-extrabold text-[#112a22]">
            {publicCount} Public · {instCount} Institutional
          </p>
        </div>
      </section>

      <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
        <h2 className="text-lg font-bold text-[#112a22]">Residence Comparison &amp; Utilisation Report</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f7f3]">
              <tr>
                <th className="p-2.5">Residence</th>
                <th className="p-2.5">Rooms</th>
                <th className="p-2.5">Active Beds</th>
                <th className="p-2.5">Active Bookings</th>
                <th className="p-2.5">Booked Occupants</th>
                <th className="p-2.5">Actual Revenue</th>
                <th className="p-2.5">Forecasted Revenue</th>
              </tr>
            </thead>
            <tbody>
              {residences.map((r) => {
                const totalBeds = r.rooms.reduce(
                  (s, rm) => s + rm.beds.filter((b) => b.isActive).length,
                  0,
                );
                const bookedPax = r.bookings.reduce((s, b) => s + b.occupants, 0);
                const actual = r.bookings.reduce((s, b) => s + b.amountPaid, 0);
                const forecast = r.bookings.reduce((s, b) => s + b.agreedTotal, 0);
                return (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="p-2.5 font-bold text-[#112a22]">{r.name}</td>
                    <td className="p-2.5">{r.rooms.length}</td>
                    <td className="p-2.5">{totalBeds}</td>
                    <td className="p-2.5">{r.bookings.length}</td>
                    <td className="p-2.5">{bookedPax}</td>
                    <td className="p-2.5 text-emerald-700 font-bold">{zar(actual)}</td>
                    <td className="p-2.5 font-semibold">{zar(forecast)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
        <h2 className="text-lg font-bold text-[#112a22]">Guest Feedback Review</h2>
        {feedbacks.length === 0 ? (
          <p className="text-sm text-neutral-600">No guest feedback submitted yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f7f3]">
              <tr>
                <th className="p-2.5">Booking / Residence</th>
                <th className="p-2.5">Guest</th>
                <th className="p-2.5">Ratings (Overall / Clean / Fac / Svc)</th>
                <th className="p-2.5">Comment</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((f) => (
                <tr key={f.id} className="border-t border-neutral-100">
                  <td className="p-2.5">
                    <div className="font-mono text-xs font-bold text-[#112a22]">{f.booking.reference}</div>
                    <div className="text-xs text-neutral-500">{f.booking.residence.name}</div>
                  </td>
                  <td className="p-2.5">{f.booking.user.firstName} {f.booking.user.lastName}</td>
                  <td className="p-2.5 font-semibold">
                    {f.rating}/5 · {f.cleanliness}/5 · {f.facilities}/5 · {f.service}/5
                  </td>
                  <td className="p-2.5 text-xs">{f.comment ?? "–"}</td>
                  <td className="p-2.5">
                    {f.reviewed ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-900">
                        Reviewed
                      </span>
                    ) : (
                      <form action={markFeedbackReviewed}>
                        <input type="hidden" name="id" value={f.id} />
                        <button className="rounded-full bg-[#112a22] px-3 py-1 text-xs font-bold text-[#c8f560]">
                          Mark Reviewed
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
