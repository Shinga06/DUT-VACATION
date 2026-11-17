import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";
import { buildPayFastCheckoutFields } from "@/lib/payment-gateway";
import { completeGatewayPayment } from "@/app/actions/bookings";

export const metadata = { title: "Secure Payment Gateway · DUT-AMP" };

export default async function GatewayCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paymentId?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { paymentId } = await searchParams;
  if (!paymentId) notFound();

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: { residence: true, user: true },
      },
    },
  });

  if (!payment || payment.bookingId !== id || payment.booking.userId !== user.id) {
    notFound();
  }

  const pf = buildPayFastCheckoutFields({
    paymentId: payment.id,
    bookingId: payment.booking.id,
    bookingReference: payment.booking.reference ?? payment.booking.id.slice(0, 8),
    residenceName: payment.booking.residence.name,
    amount: payment.amount,
    firstName: payment.booking.user.firstName,
    lastName: payment.booking.user.lastName,
    email: payment.booking.user.email,
  });

  const providerLabel =
    payment.method === "OZOW"
      ? "Ozow Instant EFT"
      : payment.method === "PEACH"
        ? "Peach Payments (Card / Apple Pay)"
        : "PayFast South Africa (Card / Instant EFT / SnapScan)";

  return (
    <div className="mx-auto max-w-xl rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_12px_40px_rgb(0,0,0,0.06)] space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
        <div>
          <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-1 text-xs font-bold text-[#112a22]">
            DUT Finance · Authorised Payment Gateway
          </span>
          <h1 className="mt-2 text-2xl font-bold text-[#112a22]">{providerLabel}</h1>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 uppercase">
          {pf.mode} mode
        </span>
      </div>

      <div className="rounded-2xl bg-[#112a22] p-5 text-white space-y-2">
        <div className="flex justify-between text-xs text-neutral-300">
          <span>Booking Reference</span>
          <span className="font-mono font-bold text-[#c8f560]">{payment.booking.reference}</span>
        </div>
        <div className="flex justify-between text-xs text-neutral-300">
          <span>Accommodation Facility</span>
          <span>{payment.booking.residence.name}</span>
        </div>
        <div className="flex justify-between text-xs text-neutral-300">
          <span>Payment Reference</span>
          <span className="font-mono">{payment.reference}</span>
        </div>
        <div className="flex justify-between items-baseline border-t border-white/15 pt-3">
          <span className="text-sm font-medium">Amount Due Now</span>
          <span className="text-3xl font-extrabold text-[#c8f560]">{zar(payment.amount)}</span>
        </div>
      </div>

      {/* Signed PayFast Hosted Checkout Form */}
      <div className="space-y-3">
        <form action={pf.actionUrl} method="POST">
          {Object.entries(pf.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button
            type="submit"
            className="w-full rounded-full bg-[#112a22] px-5 py-3 text-sm font-bold text-[#c8f560] shadow hover:bg-[#1a3d32] transition"
          >
            Continue to External {payment.method} Hosted Checkout ({pf.mode}) ↗
          </button>
        </form>

        {/* Local / Instant Return Verification Button */}
        <form action={completeGatewayPayment}>
          <input type="hidden" name="paymentId" value={payment.id} />
          <button
            type="submit"
            className="w-full rounded-full border border-[#112a22] bg-[#f2f4ef] px-5 py-2.5 text-xs font-bold text-[#112a22] hover:bg-neutral-200/70 transition"
          >
            ✓ Authorise &amp; Complete Gateway Payment Immediately (Issue Receipt &amp; Confirm Booking)
          </button>
        </form>
      </div>

      <div className="rounded-xl bg-[#f6f7f3] p-3.5 text-[11px] text-neutral-500 space-y-1">
        <p>
          <strong>Merchant ID:</strong> <code className="font-mono">{pf.fields.merchant_id}</code> ·{" "}
          <strong>ITN Webhook:</strong> <code className="font-mono">/api/payments/payfast-itn</code>
        </p>
        <p>
          Configure live DUT Finance credentials (<code className="font-mono">PAYFAST_MERCHANT_ID</code>,{" "}
          <code className="font-mono">PAYFAST_MERCHANT_KEY</code>, <code className="font-mono">PAYFAST_PASSPHRASE</code>,{" "}
          <code className="font-mono">PAYFAST_MODE=&quot;live&quot;</code>) in <code className="font-mono">.env</code>.
        </p>
      </div>

      <div className="text-center">
        <Link href={`/account/bookings/${payment.booking.id}`} className="text-xs font-bold text-neutral-600 underline">
          ← Cancel and return to booking
        </Link>
      </div>
    </div>
  );
}
