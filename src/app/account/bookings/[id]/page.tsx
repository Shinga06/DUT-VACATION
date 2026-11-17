import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";
import {
  amendBooking,
  cancelBooking,
  replyToInfoRequest,
  submitDraftBooking,
  submitFeedback,
  submitPayment,
  uploadDelegatesCsv,
} from "@/app/actions/bookings";

export const metadata = { title: "Booking Details · DUT-AMP" };

const WORKFLOW_STEPS = [
  { key: "SUBMITTED", label: "1. Submitted" },
  { key: "REVIEW", label: "2. Housing Review" },
  { key: "PAYMENT", label: "3. Payment" },
  { key: "CONFIRMED", label: "4. Confirmed & Allocated" },
  { key: "STAY", label: "5. Check-In & Stay" },
];

function getActiveStepIndex(status: string): number {
  switch (status) {
    case "DRAFT":
      return 0;
    case "PENDING_REVIEW":
      return 1;
    case "APPROVED":
    case "AWAITING_PAYMENT":
      return 2;
    case "CONFIRMED":
      return 3;
    case "CHECKED_IN":
    case "CHECKED_OUT":
      return 4;
    default:
      return -1;
  }
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      residence: true,
      guests: true,
      payments: { orderBy: { createdAt: "desc" } },
      allocations: { where: { isActive: true }, include: { room: true, bed: true } },
      preferences: true,
      feedback: true,
    },
  });
  if (!booking || booking.userId !== user.id) notFound();

  const balance = Math.max(0, booking.agreedTotal - booking.amountPaid);

  // Payment is only unlocked once the booking is in AWAITING_PAYMENT, APPROVED, or CONFIRMED (with balance > 0)
  // — never while still in DRAFT or PENDING_REVIEW!
  const canPay =
    balance > 0 &&
    ["AWAITING_PAYMENT", "APPROVED", "CONFIRMED"].includes(booking.status);

  const canAmendOrCancel = !["CANCELLED", "REJECTED", "CHECKED_OUT", "CHECKED_IN"].includes(booking.status);
  const canLeaveFeedback = booking.status === "CHECKED_OUT" || Boolean(booking.feedback);

  const checkInIso = booking.checkIn.toISOString().slice(0, 10);
  const checkOutIso = booking.checkOut.toISOString().slice(0, 10);
  const isDelegation = booking.type === "INSTITUTIONAL" || user.roleName === "Institutional Coordinator";
  const stepIdx = getActiveStepIndex(booking.status);

  return (
    <div className="space-y-8">
      {/* Top Booking Header Banner */}
      <header className="rounded-[28px] bg-[#112a22] p-6 sm:p-8 text-white shadow-md space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Link href="/account" className="text-xs font-semibold text-[#c8f560] hover:underline">
              ← Back to My Account
            </Link>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {booking.residence.name}
              </h1>
              <span className="rounded-full bg-white/15 px-3 py-0.5 font-mono text-xs font-bold text-[#c8f560]">
                {booking.reference}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-300">
              {booking.checkIn.toLocaleDateString("en-ZA")} – {booking.checkOut.toLocaleDateString("en-ZA")} ·{" "}
              {booking.occupants} occupant(s) · {booking.roomType}
              {booking.eventName ? ` · ${booking.eventName}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="rounded-full bg-white/15 px-3.5 py-1.5 font-semibold text-white">
              Status: {booking.status.replace(/_/g, " ")}
            </span>
            <span className="rounded-full bg-amber-400/20 border border-amber-300/40 px-3.5 py-1.5 font-semibold text-amber-200">
              Payment: {booking.paymentStatus.replace(/_/g, " ")}
            </span>
            {booking.status !== "DRAFT" && (
              <Link
                href={`/account/bookings/${booking.id}/document`}
                className="rounded-full bg-[#c8f560] px-4 py-2 font-bold text-[#112a22] shadow hover:bg-[#d5f880] transition"
              >
                Print / Download Invoice &amp; Confirmation
              </Link>
            )}
          </div>
        </div>

        {/* 5-Stage Visual Booking Lifecycle Stepper (Swipeable on Mobile) */}
        {stepIdx >= 0 && (
          <div className="-mx-2 flex gap-2 overflow-x-auto border-t border-white/15 px-2 pt-5 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0 no-scrollbar">
            {WORKFLOW_STEPS.map((st, idx) => {
              const done = idx < stepIdx || booking.status === "CHECKED_OUT";
              const current = idx === stepIdx && booking.status !== "CHECKED_OUT";
              return (
                <div
                  key={st.key}
                  className={`shrink-0 min-w-[140px] sm:min-w-0 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition ${
                    done
                      ? "bg-[#c8f560]/20 text-[#c8f560] border border-[#c8f560]/40"
                      : current
                        ? "bg-white text-[#112a22] font-bold shadow"
                        : "bg-white/5 text-neutral-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{st.label}</span>
                    {done && <span>✓</span>}
                    {current && <span className="h-2 w-2 rounded-full bg-[#112a22]" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </header>

      {/* Contextual Next-Step Callout Banner */}
      {booking.status === "DRAFT" && (
        <section className="rounded-[24px] border border-amber-300 bg-amber-50 p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-amber-200 px-3 py-0.5 text-xs font-bold text-amber-950">
              Draft Booking · Inventory Not Yet Reserved
            </span>
            <h2 className="text-lg font-bold text-[#112a22]">Ready to submit your booking?</h2>
            <p className="text-xs text-neutral-700">
              Draft bookings do not hold rooms or beds until submitted. Review your guest/delegate roster below and click
              Submit when ready.
            </p>
          </div>
          <form action={submitDraftBooking}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <button className="rounded-full bg-[#112a22] px-6 py-3 text-xs font-bold text-[#c8f560] shadow hover:bg-[#1a3d32]">
              Submit Booking Now →
            </button>
          </form>
        </section>
      )}

      {booking.status === "PENDING_REVIEW" && (
        <section className="rounded-[24px] border border-blue-200 bg-blue-50/80 p-6 space-y-4">
          <div className="space-y-1">
            <span className="inline-block rounded-full bg-[#112a22] px-3 py-0.5 text-xs font-bold text-[#c8f560]">
              Step 2 · Under Student Housing Review
            </span>
            <h2 className="text-lg font-bold text-[#112a22]">
              Your booking request is being reviewed by Student Housing
            </h2>
            <p className="text-xs text-neutral-700">
              Institutional delegations, group bookings (5+ occupants), and special accommodation requests are reviewed by
              Student Housing before payment is unlocked. Once approved, you will be notified to complete payment.
            </p>
          </div>

          {booking.notes && (
            <div className="rounded-2xl bg-white p-4 border border-blue-200 space-y-3">
              <p className="text-xs font-bold text-[#112a22]">Review Notes &amp; Information Requests:</p>
              <p className="text-xs text-neutral-700 font-mono">{booking.notes}</p>
              <form action={replyToInfoRequest} className="flex flex-wrap gap-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                <input
                  name="reply"
                  required
                  placeholder="Provide requested details or clarification for Student Housing…"
                  className="flex-1 rounded-xl border border-neutral-300 px-3 py-1.5 text-xs"
                />
                <button className="rounded-full bg-[#112a22] px-4 py-1.5 text-xs font-bold text-[#c8f560]">
                  Send Response
                </button>
              </form>
            </div>
          )}
        </section>
      )}

      {booking.paymentStatus === "PENDING_VERIFICATION" && (
        <section className="rounded-[24px] border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
          <strong>EFT Proof of Payment Submitted:</strong> Our Finance Officer is verifying your EFT transfer against
          reference <strong className="font-mono">{booking.reference}-PAY</strong>. Once verified, your official receipt
          and room allocation will be issued automatically.
        </section>
      )}

      {/* Summary Bento Row */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Stay &amp; Facility</p>
          <p className="mt-1.5 font-bold text-[#112a22]">
            {booking.checkIn.toLocaleDateString("en-ZA")} – {booking.checkOut.toLocaleDateString("en-ZA")}
          </p>
          <p className="text-xs text-neutral-600 mt-1">
            {booking.residence.address ?? booking.residence.name}
          </p>
        </div>

        <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Financial Summary</p>
          <p className="mt-1.5 font-bold text-[#112a22]">Agreed Total: {zar(booking.agreedTotal)}</p>
          <p className="text-xs text-emerald-700 font-medium mt-0.5">Paid (Verified): {zar(booking.amountPaid)}</p>
          <p className="text-xs font-bold text-amber-800 mt-0.5">Outstanding: {zar(balance)}</p>
        </div>

        <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Allocated Room / Bed</p>
          {booking.allocations.length === 0 ? (
            <p className="mt-1.5 text-sm text-neutral-600">Assigned upon booking confirmation</p>
          ) : (
            <ul className="mt-1.5 text-sm font-bold text-[#112a22] space-y-0.5">
              {booking.allocations.map((a) => (
                <li key={a.id}>
                  Room {a.room.roomNumber} {a.bed ? `· Bed ${a.bed.label}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Step 3: Payment Section (Only shown when in AWAITING_PAYMENT / APPROVED / CONFIRMED with balance > 0) */}
      {canPay && (
        <section className="rounded-[26px] border-2 border-[#112a22] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-block rounded-full bg-[#c8f560] px-3 py-0.5 text-xs font-bold text-[#112a22]">
                Action Required · Complete Payment
              </span>
              <h2 className="mt-1 text-lg font-bold text-[#112a22]">Make a Payment</h2>
              <p className="text-xs text-neutral-600 mt-0.5">
                Pay online via PayFast / Ozow / Peach for instant confirmation, or upload your EFT Proof of Payment using
                reference <strong className="font-mono text-[#112a22]">{booking.reference}-PAY</strong>.
              </p>
            </div>
          </div>
          <form action={submitPayment} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="bookingId" value={booking.id} />
            <div>
              <label htmlFor="method" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Payment Gateway / Method
              </label>
              <select
                id="method"
                name="method"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
              >
                <option value="PAYFAST">PayFast Gateway (Card / Instant EFT)</option>
                <option value="OZOW">Ozow Instant EFT Gateway</option>
                <option value="PEACH">Peach Payments Gateway</option>
                <option value="EFT">Manual EFT Bank Transfer (Upload POP)</option>
              </select>
            </div>
            <div>
              <label htmlFor="amount" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Amount (ZAR)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min={1}
                max={balance}
                defaultValue={balance}
                required
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
              />
            </div>
            <div>
              <label htmlFor="popFile" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Upload EFT Proof (.pdf/.png/.jpg)
              </label>
              <input
                id="popFile"
                name="popFile"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="mt-1.5 w-full text-xs"
              />
            </div>
            <div>
              <label htmlFor="proofUrl" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Or Bank POP Note (EFT)
              </label>
              <input
                id="proofUrl"
                name="proofUrl"
                placeholder="e.g. FNB POP #98231"
                className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="self-end">
              <button className="w-full rounded-full bg-[#112a22] px-4 py-2.5 text-xs font-bold text-[#c8f560] hover:bg-[#1a3d32] transition">
                Proceed to Payment →
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Check-in Instructions Banner (Prominent when CONFIRMED or CHECKED_IN) */}
      {["CONFIRMED", "CHECKED_IN", "AWAITING_PAYMENT", "APPROVED"].includes(booking.status) && (
        <section className="rounded-[24px] border border-neutral-200 bg-[#f2f4ef] p-5 text-sm text-[#112a22] space-y-1.5">
          <h2 className="font-bold">Check-in Instructions, Rules &amp; Assistance</h2>
          <p className="text-xs text-neutral-700 leading-relaxed">
            <strong>Reception &amp; Arrival:</strong> {booking.residence.address ?? booking.residence.name} · Check-in
            from 14:00, Check-out by 10:00. Present a valid ID or Passport and your booking reference (
            <strong className="font-mono">{booking.reference}</strong>).
          </p>
          <p className="text-xs text-neutral-700 leading-relaxed">
            <strong>Residence Conditions:</strong> Quiet hours 22:00–06:00. Need assistance? Contact DUT Student Housing
            Helpdesk at <strong>housing-support@dut.ac.za</strong>.
          </p>
        </section>
      )}

      {/* Post-Stay Guest Feedback (ONLY shown once CHECKED_OUT, per FR-115) */}
      {canLeaveFeedback && (
        <section className="rounded-[26px] border-2 border-[#112a22] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3">
          <div>
            <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-0.5 text-xs font-bold text-[#112a22]">
              Completed Stay · Share Your Experience
            </span>
            <h2 className="mt-1 text-lg font-bold text-[#112a22]">Post-Stay Guest Feedback</h2>
          </div>
          {booking.feedback ? (
            <div className="text-sm space-y-1">
              <p className="font-bold text-[#112a22]">
                Thank you for your feedback! Overall: {booking.feedback.rating}/5 · Cleanliness:{" "}
                {booking.feedback.cleanliness}/5 · Facilities: {booking.feedback.facilities}/5 · Service:{" "}
                {booking.feedback.service}/5
              </p>
              {booking.feedback.comment && (
                <p className="text-neutral-600 italic">&ldquo;{booking.feedback.comment}&rdquo;</p>
              )}
            </div>
          ) : (
            <form action={submitFeedback} className="grid gap-3 sm:grid-cols-4 text-sm">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div>
                <label htmlFor="fb-r" className="block text-xs font-semibold">Overall (1–5)</label>
                <input id="fb-r" name="rating" type="number" min={1} max={5} defaultValue={5} required className="mt-1 w-full rounded-xl border px-3 py-1.5" />
              </div>
              <div>
                <label htmlFor="fb-c" className="block text-xs font-semibold">Cleanliness (1–5)</label>
                <input id="fb-c" name="cleanliness" type="number" min={1} max={5} defaultValue={5} required className="mt-1 w-full rounded-xl border px-3 py-1.5" />
              </div>
              <div>
                <label htmlFor="fb-f" className="block text-xs font-semibold">Facilities (1–5)</label>
                <input id="fb-f" name="facilities" type="number" min={1} max={5} defaultValue={5} required className="mt-1 w-full rounded-xl border px-3 py-1.5" />
              </div>
              <div>
                <label htmlFor="fb-s" className="block text-xs font-semibold">Customer Service (1–5)</label>
                <input id="fb-s" name="service" type="number" min={1} max={5} defaultValue={5} required className="mt-1 w-full rounded-xl border px-3 py-1.5" />
              </div>
              <div className="sm:col-span-3">
                <input name="comment" placeholder="Written comments about your stay" className="w-full rounded-xl border px-3.5 py-2" />
              </div>
              <div>
                <button className="w-full rounded-full bg-[#112a22] px-4 py-2 font-bold text-[#c8f560]">
                  Submit Feedback
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {booking.preferences.length > 0 && (
        <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3">
          <h2 className="text-lg font-bold text-[#112a22]">Accommodation Preferences</h2>
          <ul className="space-y-2 text-sm">
            {booking.preferences.map((pr) => (
              <li key={pr.id} className="rounded-2xl bg-[#f6f7f3] p-4 flex flex-wrap justify-between gap-2">
                <div>
                  <span className="font-bold text-[#112a22]">{pr.kind}:</span> {pr.details}
                  {pr.response && <p className="text-xs text-neutral-600 mt-1">Student Housing note: {pr.response}</p>}
                </div>
                <span className="rounded-full bg-white px-3 py-0.5 text-xs font-bold text-[#112a22] h-fit">
                  {pr.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3">
        <h2 className="text-lg font-bold text-[#112a22]">Payment History &amp; Receipts</h2>
        {booking.payments.length === 0 ? (
          <p className="text-sm text-neutral-600">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f6f7f3]">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Method</th>
                  <th className="p-2.5">Reference</th>
                  <th className="p-2.5">Amount</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {booking.payments.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="p-2.5">{p.createdAt.toLocaleDateString("en-ZA")}</td>
                    <td className="p-2.5">{p.method}</td>
                    <td className="p-2.5 font-mono text-xs">{p.reference}</td>
                    <td className="p-2.5 font-semibold">{zar(p.amount)}</td>
                    <td className="p-2.5">{p.status}</td>
                    <td className="p-2.5 font-mono text-xs">{p.receiptNo ?? "Pending verification"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
        <h2 className="text-lg font-bold text-[#112a22]">
          {isDelegation ? "Registered Delegates & Bulk Roster" : "Registered Guest Details"}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f7f3]">
              <tr>
                <th className="p-2.5">Name</th>
                <th className="p-2.5">Email / Phone</th>
                <th className="p-2.5">Student / Staff / ID</th>
                <th className="p-2.5">Arrival – Departure</th>
                <th className="p-2.5">Confirmation</th>
              </tr>
            </thead>
            <tbody>
              {booking.guests.map((g) => (
                <tr key={g.id} className="border-t border-neutral-100">
                  <td className="p-2.5 font-medium text-[#112a22]">{g.firstName} {g.lastName}</td>
                  <td className="p-2.5 text-xs">{g.email ?? "–"} · {g.phone ?? "–"}</td>
                  <td className="p-2.5 text-xs">{g.studentOrStaffNo ?? g.idNumber ?? "–"}</td>
                  <td className="p-2.5 text-xs">
                    {(g.arrivalDate ?? booking.checkIn).toLocaleDateString("en-ZA")} –{" "}
                    {(g.departureDate ?? booking.checkOut).toLocaleDateString("en-ZA")}
                  </td>
                  <td className="p-2.5 text-xs">
                    <Link
                      href={`/account/bookings/${booking.id}/document?guestId=${g.id}`}
                      className="font-bold text-[#112a22] underline"
                    >
                      Confirmation Letter →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canAmendOrCancel && isDelegation && (
          <details className="rounded-2xl border border-neutral-200 bg-[#f6f7f3] p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#112a22]">
              + Bulk Upload Delegates via CSV
            </summary>
            <form action={uploadDelegatesCsv} className="mt-3 space-y-3 text-sm">
              <input type="hidden" name="bookingId" value={booking.id} />
              <p className="text-xs text-neutral-600">
                Format: <code>firstName,lastName,email,phone,studentOrStaffNo,arrivalDate(YYYY-MM-DD),departureDate(YYYY-MM-DD)</code>. Duplicate records are automatically skipped.
              </p>
              <div>
                <label htmlFor="csvFile" className="block text-xs font-semibold">Upload .csv File</label>
                <input id="csvFile" name="csvFile" type="file" accept=".csv,text/csv" className="mt-1 text-xs" />
              </div>
              <div>
                <label htmlFor="csvText" className="block text-xs font-semibold">Or Paste CSV Rows</label>
                <textarea
                  id="csvText"
                  name="csvText"
                  rows={3}
                  placeholder="Sipho,Ndlovu,sipho@ukzn.ac.za,0821112222,STF-901,2026-12-05,2026-12-10"
                  className="mt-1 w-full rounded-xl border border-neutral-300 p-2.5 font-mono text-xs"
                />
              </div>
              <button className="rounded-full bg-[#112a22] px-4 py-2 text-xs font-bold text-[#c8f560]">
                Validate &amp; Import Delegates
              </button>
            </form>
          </details>
        )}
      </section>

      {canAmendOrCancel && (
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3">
            <h2 className="text-lg font-bold text-[#112a22]">Amend Booking</h2>
            <p className="text-xs text-neutral-600">
              Validates availability and recalculates cost automatically.
            </p>
            <form action={amendBooking} className="grid gap-3 sm:grid-cols-3 text-sm">
              <input type="hidden" name="bookingId" value={booking.id} />
              <div>
                <label htmlFor="am-in" className="block text-xs font-semibold">New Check-in</label>
                <input id="am-in" name="checkIn" type="date" defaultValue={checkInIso} required className="mt-1 w-full rounded-xl border px-2.5 py-1.5" />
              </div>
              <div>
                <label htmlFor="am-out" className="block text-xs font-semibold">New Check-out</label>
                <input id="am-out" name="checkOut" type="date" defaultValue={checkOutIso} required className="mt-1 w-full rounded-xl border px-2.5 py-1.5" />
              </div>
              <div>
                <label htmlFor="am-occ" className="block text-xs font-semibold">Occupants</label>
                <input id="am-occ" name="occupants" type="number" min={1} defaultValue={booking.occupants} required className="mt-1 w-full rounded-xl border px-2.5 py-1.5" />
              </div>
              <div className="sm:col-span-3 pt-1">
                <button className="rounded-full bg-[#112a22] px-5 py-2 text-xs font-bold text-[#c8f560]">
                  Validate &amp; Apply Amendment
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-3">
            <h2 className="text-lg font-bold text-[#112a22]">Cancel Booking</h2>
            <p className="text-xs text-neutral-600">
              Cancelling releases allocated rooms/beds and calculates any eligible policy refund automatically.
            </p>
            <form action={cancelBooking} className="space-y-3">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input
                name="reason"
                placeholder="Reason for cancellation"
                className="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm"
              />
              <button className="rounded-full border border-red-600 px-5 py-2 text-xs font-bold text-red-700 hover:bg-red-50">
                Cancel Booking
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
