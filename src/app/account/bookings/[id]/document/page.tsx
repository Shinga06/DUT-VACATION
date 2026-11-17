import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";
import { hasPermission } from "@/lib/permissions";
import PrintButton from "./PrintButton";

export const metadata = { title: "Official Booking Document · DUT-AMP" };

export default async function BookingDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guestId?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { guestId } = await searchParams;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      user: true,
      residence: true,
      guests: true,
      payments: { where: { status: "VERIFIED" }, orderBy: { verifiedAt: "desc" } },
      allocations: { where: { isActive: true }, include: { room: true, bed: true } },
    },
  });

  const isStaff = hasPermission(user.permissions, "bookings.view");
  if (!booking || (booking.userId !== user.id && !isStaff)) notFound();

  const selectedGuest = guestId ? booking.guests.find((g) => g.id === guestId) : null;
  const balance = Math.max(0, booking.agreedTotal - booking.amountPaid);

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-lg border bg-white p-8 shadow print:border-0 print:shadow-none">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/account/bookings/${booking.id}`} className="text-sm text-blue-800 underline">
          ← Back to booking
        </Link>
        <PrintButton />
      </div>

      <header className="border-b pb-4 flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-900">
            Durban University of Technology · Student Housing Department
          </p>
          <h1 className="text-2xl font-bold mt-1">
            {selectedGuest
              ? "Individual Delegate Accommodation Confirmation"
              : "Booking Confirmation, Invoice & Payment Receipt"}
          </h1>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono font-bold">{booking.reference}</p>
          <p>Status: {booking.status}</p>
          <p>Issued: {new Date().toLocaleDateString("en-ZA")}</p>
        </div>
      </header>

      {selectedGuest ? (
        <section className="space-y-2 text-sm">
          <h2 className="font-semibold text-base">Delegate Details</h2>
          <p><strong>Name:</strong> {selectedGuest.firstName} {selectedGuest.lastName}</p>
          <p><strong>Institution:</strong> {selectedGuest.institution ?? booking.institution ?? "–"}</p>
          <p><strong>Staff / Student / ID No:</strong> {selectedGuest.studentOrStaffNo ?? selectedGuest.idNumber ?? "–"}</p>
          <p>
            <strong>Arrival – Departure:</strong>{" "}
            {(selectedGuest.arrivalDate ?? booking.checkIn).toLocaleDateString("en-ZA")} –{" "}
            {(selectedGuest.departureDate ?? booking.checkOut).toLocaleDateString("en-ZA")}
          </p>
          <p><strong>Residence:</strong> {booking.residence.name} ({booking.residence.address})</p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <h2 className="font-semibold">Billed To</h2>
              <p>{booking.user.firstName} {booking.user.lastName}</p>
              {booking.institution && <p>{booking.institution}</p>}
              <p>{booking.user.email}</p>
            </div>
            <div>
              <h2 className="font-semibold">Accommodation Facility</h2>
              <p>{booking.residence.name}</p>
              <p>{booking.residence.address}</p>
              <p>
                Stay: {booking.checkIn.toLocaleDateString("en-ZA")} to {booking.checkOut.toLocaleDateString("en-ZA")} ({booking.occupants} occupant(s))
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-sm">Invoice Summary</h2>
            <table className="w-full border text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2">Description</th>
                  <th className="p-2">Room Type</th>
                  <th className="p-2">Allocated Room(s)</th>
                  <th className="p-2 text-right">Agreed Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-2">
                    Accommodation ({booking.type}){booking.eventName ? ` – ${booking.eventName}` : ""}
                  </td>
                  <td className="p-2">{booking.roomType}</td>
                  <td className="p-2">
                    {booking.allocations.length === 0
                      ? "Pending allocation"
                      : booking.allocations.map((a) => `R${a.room.roomNumber}${a.bed ? `-${a.bed.label}` : ""}`).join(", ")}
                  </td>
                  <td className="p-2 text-right font-semibold">{zar(booking.agreedTotal)}</td>
                </tr>
              </tbody>
            </table>
            <div className="flex justify-end gap-6 text-sm pt-2">
              <span>Verified Paid: <strong>{zar(booking.amountPaid)}</strong></span>
              <span>Outstanding Balance: <strong>{zar(balance)}</strong></span>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-sm">Verified Payment Receipts</h2>
            {booking.payments.length === 0 ? (
              <p className="text-xs text-slate-600">No verified payments recorded yet.</p>
            ) : (
              <table className="w-full border text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2">Receipt No.</th>
                    <th className="p-2">Method</th>
                    <th className="p-2">Reference</th>
                    <th className="p-2">Verified Date</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.payments.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2 font-mono">{p.receiptNo}</td>
                      <td className="p-2">{p.method}</td>
                      <td className="p-2 font-mono">{p.reference}</td>
                      <td className="p-2">{p.verifiedAt?.toLocaleDateString("en-ZA")}</td>
                      <td className="p-2 text-right">{zar(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <footer className="border-t pt-4 text-xs text-slate-500">
        Official Durban University of Technology Student Housing document. Use your browser&apos;s Print → Save as PDF to download.
      </footer>
    </div>
  );
}
