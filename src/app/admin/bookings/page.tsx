import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";
import { hasPermission } from "@/lib/permissions";
import {
  checkInOutBooking,
  manualAllocateRoom,
  recordArrivalAnomaly,
  reviewBooking,
  updatePreferenceStatus,
  verifyPayment,
} from "@/app/actions/bookings";

export const metadata = { title: "Bookings & Payments · Admin · DUT-AMP" };

export default async function AdminBookingsPage() {
  const user = await requirePermission("bookings.view");
  const canReview = hasPermission(user.permissions, "bookings.review");
  const canVerify = hasPermission(user.permissions, "payments.verify");
  const canCheckIn = hasPermission(user.permissions, "checkin.manage");
  const canAllocate = hasPermission(user.permissions, "allocations.manage");

  const scopeFilter = user.scopedResidenceId ? { residenceId: user.scopedResidenceId } : {};

  const [bookings, pendingPayments, preferences, availableRooms] = await Promise.all([
    db.booking.findMany({
      where: scopeFilter,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        residence: true,
        allocations: { where: { isActive: true }, include: { room: true, bed: true } },
      },
    }),
    db.payment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { booking: { include: { user: true, residence: true } } },
    }),
    db.preference.findMany({
      include: { booking: { include: { user: true, residence: true } } },
    }),
    db.room.findMany({
      where: { isActive: true, opStatus: "AVAILABLE", ...scopeFilter },
      orderBy: { roomNumber: "asc" },
      include: { residence: true },
    }),
  ]);

  const pendingReviews = bookings.filter((b) => b.status === "PENDING_REVIEW");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#112a22]">
          Bookings, Approvals, EFT Verification &amp; Front-Desk Check-In
        </h1>
        <p className="text-xs text-neutral-500">
          Organised by operational workflow stage: 1. Housing Review → 2. Finance EFT Verification → 3. Preferences &amp; Room Allocation → 4. Check-In / Check-Out.
        </p>
      </div>

      {/* QUEUE 1: Student Housing Review Queue (PENDING_REVIEW) */}
      {canReview && pendingReviews.length > 0 && (
        <section className="rounded-[26px] border-2 border-[#112a22] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-block rounded-full bg-[#c8f560] px-3 py-0.5 text-xs font-bold text-[#112a22]">
                Stage 1 · Student Housing Approval Queue ({pendingReviews.length})
              </span>
              <h2 className="mt-1 text-lg font-bold text-[#112a22]">
                Institutional &amp; Special Group Requests Awaiting Review
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {pendingReviews.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-neutral-200 bg-[#f6f7f3] p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#112a22]">{b.reference}</span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-[#112a22]">
                      {b.type}
                    </span>
                    <span className="font-bold text-[#112a22]">
                      {b.user.firstName} {b.user.lastName}
                    </span>
                    {b.institution && <span className="text-xs text-neutral-600">· {b.institution}</span>}
                  </div>
                  <p className="text-xs text-neutral-600">
                    <strong>{b.residence.name}</strong> · {b.checkIn.toLocaleDateString("en-ZA")} –{" "}
                    {b.checkOut.toLocaleDateString("en-ZA")} · {b.occupants} occupant(s) ({b.roomType}) ·{" "}
                    <strong>{zar(b.agreedTotal)}</strong>
                    {b.eventName ? ` · Event: ${b.eventName}` : ""}
                  </p>
                  {b.notes && <p className="text-xs font-mono text-amber-900">{b.notes}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={reviewBooking}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <button className="rounded-full bg-[#112a22] px-4 py-1.5 text-xs font-bold text-[#c8f560]">
                      Approve &amp; Unlock Payment
                    </button>
                  </form>

                  <form action={reviewBooking} className="flex items-center gap-1.5">
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="decision" value="REQUEST_INFO" />
                    <input
                      name="infoMessage"
                      placeholder="Ask coordinator for info…"
                      className="rounded-full border border-neutral-300 px-3 py-1 text-xs"
                    />
                    <button className="rounded-full border border-[#112a22] bg-white px-3 py-1 text-xs font-bold text-[#112a22]">
                      Request Info
                    </button>
                  </form>

                  <form action={reviewBooking}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <button className="rounded-full border border-red-600 px-3 py-1 text-xs font-bold text-red-700">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* QUEUE 2: Finance Officer EFT Verification Queue */}
      {canVerify && (
        <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-0.5 text-xs font-bold text-[#112a22]">
                Stage 2 · Finance Verification Queue ({pendingPayments.length})
              </span>
              <h2 className="mt-1 text-lg font-bold text-[#112a22]">
                Pending EFT Payments Awaiting Finance Verification
              </h2>
            </div>
          </div>

          {pendingPayments.length === 0 ? (
            <p className="text-sm text-neutral-600">No EFT payments awaiting verification.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f6f7f3]">
                  <tr>
                    <th className="p-2.5">Booking Ref</th>
                    <th className="p-2.5">Guest</th>
                    <th className="p-2.5">EFT Reference</th>
                    <th className="p-2.5">Proof of Payment</th>
                    <th className="p-2.5">Amount</th>
                    <th className="p-2.5">Finance Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.map((p) => (
                    <tr key={p.id} className="border-t border-neutral-100">
                      <td className="p-2.5 font-mono text-xs font-bold text-[#112a22]">{p.booking.reference}</td>
                      <td className="p-2.5">{p.booking.user.firstName} {p.booking.user.lastName}</td>
                      <td className="p-2.5 font-mono text-xs">{p.reference}</td>
                      <td className="p-2.5 text-xs">
                        {p.proofUrl?.startsWith("/uploads/") ? (
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-[#112a22] underline"
                          >
                            View Uploaded Proof ↗
                          </a>
                        ) : (
                          p.proofUrl
                        )}
                      </td>
                      <td className="p-2.5 font-bold">{zar(p.amount)}</td>
                      <td className="p-2.5 flex gap-2">
                        <form action={verifyPayment}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input type="hidden" name="decision" value="VERIFIED" />
                          <button className="rounded-full bg-emerald-800 px-3.5 py-1 text-xs font-bold text-white">
                            Verify &amp; Issue Receipt
                          </button>
                        </form>
                        <form action={verifyPayment}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <button className="rounded-full border border-red-600 px-3 py-1 text-xs font-bold text-red-700">
                            Reject
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* QUEUE 3: Accommodation Preferences Review */}
      {canAllocate && preferences.length > 0 && (
        <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3">
          <h2 className="text-lg font-bold text-[#112a22]">Accommodation Preferences Review</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f7f3]">
              <tr>
                <th className="p-2.5">Booking</th>
                <th className="p-2.5">Guest</th>
                <th className="p-2.5">Request</th>
                <th className="p-2.5">Update Status &amp; Response</th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((pr) => (
                <tr key={pr.id} className="border-t border-neutral-100">
                  <td className="p-2.5 font-mono text-xs font-bold text-[#112a22]">{pr.booking.reference}</td>
                  <td className="p-2.5">{pr.booking.user.firstName} {pr.booking.user.lastName}</td>
                  <td className="p-2.5 text-xs">{pr.details}</td>
                  <td className="p-2.5">
                    <form action={updatePreferenceStatus} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={pr.id} />
                      <select name="status" defaultValue={pr.status} className="rounded-lg border px-2 py-1 text-xs">
                        <option value="PENDING">PENDING</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="PARTIALLY_ACCOMMODATED">PARTIALLY ACCOMMODATED</option>
                        <option value="DECLINED">DECLINED</option>
                      </select>
                      <input name="response" defaultValue={pr.response ?? ""} placeholder="Response note to guest" className="rounded-lg border px-2.5 py-1 text-xs" />
                      <button className="rounded-full bg-[#112a22] px-3.5 py-1 text-xs font-bold text-[#c8f560]">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* QUEUE 4: Master Bookings, Allocations & Front-Desk Check-in/Check-out Registry */}
      <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3">
        <h2 className="text-lg font-bold text-[#112a22]">Complete Bookings, Allocations &amp; Front-Desk Operations</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f7f3]">
              <tr>
                <th className="p-2.5">Ref</th>
                <th className="p-2.5">Guest / Institution</th>
                <th className="p-2.5">Residence &amp; Dates</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Paid / Total</th>
                <th className="p-2.5">Room / Bed Allocation</th>
                <th className="p-2.5">Front-Desk Operations</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const resRooms = availableRooms.filter((r) => r.residenceId === b.residenceId);
                return (
                  <tr key={b.id} className="border-t border-neutral-100 align-top">
                    <td className="p-2.5 font-mono text-xs font-bold text-[#112a22]">{b.reference}</td>
                    <td className="p-2.5">
                      <div className="font-semibold text-[#112a22]">{b.user.firstName} {b.user.lastName}</div>
                      <div className="text-xs text-neutral-500">{b.type} {b.institution ? `· ${b.institution}` : ""}</div>
                      {b.notes && <div className="text-xs text-amber-800 mt-0.5 font-mono">{b.notes}</div>}
                    </td>
                    <td className="p-2.5">
                      <div className="font-medium">{b.residence.name}</div>
                      <div className="text-xs text-neutral-600">
                        {b.checkIn.toLocaleDateString("en-ZA")} – {b.checkOut.toLocaleDateString("en-ZA")} ({b.occupants} pax)
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className="rounded-full bg-[#e6ece8] px-2.5 py-0.5 text-xs font-bold text-[#112a22]">
                        {b.status}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold">{zar(b.amountPaid)} / {zar(b.agreedTotal)}</div>
                      <div className="text-xs text-neutral-500">{b.paymentStatus}</div>
                    </td>
                    <td className="p-2.5 text-xs space-y-1.5">
                      <div className="font-semibold text-[#112a22]">
                        {b.allocations.length === 0
                          ? "Pending allocation"
                          : b.allocations.map((a) => `R${a.room.roomNumber}${a.bed ? `-${a.bed.label}` : ""}`).join(", ")}
                      </div>
                      {canAllocate &&
                        b.allocations.length < b.occupants &&
                        !["DRAFT", "CANCELLED", "REJECTED", "CHECKED_OUT"].includes(b.status) && (
                          <form action={manualAllocateRoom} className="flex gap-1">
                            <input type="hidden" name="bookingId" value={b.id} />
                            <select name="roomId" className="rounded-lg border px-1.5 py-0.5 text-xs">
                              {resRooms.map((r) => (
                                <option key={r.id} value={r.id}>Room {r.roomNumber} ({r.type})</option>
                              ))}
                            </select>
                            <button className="rounded-full bg-[#112a22] px-2.5 py-0.5 text-xs font-bold text-[#c8f560]">
                              Assign
                            </button>
                          </form>
                        )}
                    </td>
                    <td className="p-2.5 space-y-1.5">
                      {canCheckIn && b.status === "CONFIRMED" && (
                        <div className="space-y-1.5">
                          <form action={checkInOutBooking}>
                            <input type="hidden" name="bookingId" value={b.id} />
                            <input type="hidden" name="action" value="CHECK_IN" />
                            <button className="rounded-full bg-emerald-800 px-3 py-1 text-xs font-bold text-white">
                              ✓ Check Guest In
                            </button>
                          </form>
                          <form action={recordArrivalAnomaly} className="flex gap-1">
                            <input type="hidden" name="bookingId" value={b.id} />
                            <select name="anomaly" className="rounded-lg border px-1.5 py-0.5 text-xs">
                              <option value="LATE_ARRIVAL">Late arrival</option>
                              <option value="NO_SHOW">No-show</option>
                            </select>
                            <button className="rounded-lg border px-2 py-0.5 text-xs font-medium">Log</button>
                          </form>
                        </div>
                      )}
                      {canCheckIn && b.status === "CHECKED_IN" && (
                        <div className="space-y-1.5">
                          <form action={checkInOutBooking}>
                            <input type="hidden" name="bookingId" value={b.id} />
                            <input type="hidden" name="action" value="CHECK_OUT" />
                            <button className="rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white">
                              Check Out &amp; Queue Cleaning
                            </button>
                          </form>
                          <form action={recordArrivalAnomaly}>
                            <input type="hidden" name="bookingId" value={b.id} />
                            <input type="hidden" name="anomaly" value="EARLY_DEPARTURE" />
                            <button className="rounded-lg border px-2 py-0.5 text-xs font-medium">
                              Log early departure
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {bookings.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-neutral-600">No bookings recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
