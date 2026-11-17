import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Admin Dashboard · DUT-AMP" };

export default async function AdminDashboard() {
  const user = await requirePermission("dashboard.view");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const [
    byStatus,
    pending,
    arrivals,
    departures,
    rooms,
    openMaintenance,
    cleaning,
    payments,
    pendingEftCount,
    residences,
    recentBookings,
  ] = await Promise.all([
    db.booking.groupBy({ by: ["status"], _count: true }),
    db.booking.count({ where: { status: "PENDING_REVIEW" } }),
    db.booking.count({
      where: { checkIn: { gte: today, lt: tomorrow }, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
    }),
    db.booking.count({ where: { checkOut: { gte: today, lt: tomorrow }, status: "CHECKED_IN" } }),
    db.room.groupBy({ by: ["opStatus"], where: { isActive: true }, _count: true }),
    db.maintenanceRequest.count({ where: { status: { not: "RESOLVED" } } }),
    db.cleaningTask.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    db.booking.aggregate({
      where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
      _sum: { agreedTotal: true, amountPaid: true },
    }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.residence.findMany({
      where: { isActive: true },
      include: {
        rooms: { where: { isActive: true }, include: { beds: { where: { isActive: true } } } },
        bookings: { where: { status: { in: ["APPROVED", "AWAITING_PAYMENT", "CONFIRMED", "CHECKED_IN"] } } },
      },
    }),
    db.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: true, residence: true },
    }),
  ]);

  const showFinance = hasPermission(user.permissions, "finance.reports");
  const verifiedRev = payments._sum.amountPaid ?? 0;
  const outstanding = Math.max(0, (payments._sum.agreedTotal ?? 0) - verifiedRev);

  return (
    <div className="space-y-8">
      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Reviews &amp; EFT</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">Action Required</span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-[#0b2a5b]">
            {pending} Reviews · {pendingEftCount} EFTs
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Institutional / group requests &amp; proof of payment queue
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Front-Desk Today</span>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-[#0b2a5b]">Arrivals &amp; Departures</span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-[#0b2a5b]">
            {arrivals} In · {departures} Out
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Open tasks: {cleaning} Cleaning · {openMaintenance} Maintenance
          </p>
        </div>

        {showFinance && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Financial Position</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Verified ZAR</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold text-emerald-700">{zar(verifiedRev)}</p>
            <p className="mt-1 text-xs text-red-700 font-medium">
              Outstanding balance: {zar(outstanding)}
            </p>
          </div>
        )}
      </div>

      {/* Residence Capacity & Utilisation Bars */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-[#112a22]">Residence Capacity &amp; Active Allocation</h2>
          <div className="space-y-4">
            {residences.map((res) => {
              const totalBeds = res.rooms.reduce((s, rm) => s + rm.beds.length, 0);
              const allocatedPax = res.bookings.reduce((s, b) => s + b.occupants, 0);
              const pct = totalBeds > 0 ? Math.min(100, Math.round((allocatedPax / totalBeds) * 100)) : 0;
              return (
                <div key={res.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-800">{res.name}</span>
                    <span className="text-xs text-slate-600">
                      {allocatedPax} / {totalBeds} beds booked ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0b2a5b] to-amber-400 transition-all"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-[#112a22]">Operational &amp; Booking Status Breakdown</h2>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Bookings by Status</p>
            {byStatus.length === 0 ? (
              <p className="text-sm text-slate-600">No bookings recorded yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {byStatus.map((s) => (
                  <li
                    key={s.status}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#0b2a5b]"
                  >
                    {s.status.replace(/_/g, " ")}: <span className="font-extrabold">{s._count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Rooms by Readiness Status</p>
            <ul className="flex flex-wrap gap-2">
              {rooms.map((r) => (
                <li
                  key={r.opStatus}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  {r.opStatus.replace(/_/g, " ")}: <span className="font-extrabold">{r._count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Recent Bookings Activity */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0b2a5b]">Recent Bookings &amp; Delegations</h2>
          <Link href="/admin/bookings" className="text-xs font-bold text-blue-800 hover:underline">
            Manage all bookings →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2.5">Reference</th>
                <th className="p-2.5">Guest / Coordinator</th>
                <th className="p-2.5">Residence</th>
                <th className="p-2.5">Dates</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Agreed Total</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-2.5 font-mono text-xs font-semibold text-[#0b2a5b]">{b.reference}</td>
                  <td className="p-2.5">
                    {b.user.firstName} {b.user.lastName}{" "}
                    <span className="text-xs text-slate-500">({b.type})</span>
                  </td>
                  <td className="p-2.5">{b.residence.name}</td>
                  <td className="p-2.5 text-xs">
                    {b.checkIn.toLocaleDateString("en-ZA")} – {b.checkOut.toLocaleDateString("en-ZA")}
                  </td>
                  <td className="p-2.5">
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-[#0b2a5b]">
                      {b.status}
                    </span>
                  </td>
                  <td className="p-2.5 text-right font-semibold">{zar(b.agreedTotal)}</td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
