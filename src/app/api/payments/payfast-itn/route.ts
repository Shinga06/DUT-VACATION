import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPayFastConfig, signPayFastPayload } from "@/lib/payment-gateway";

/**
 * PayFast Instant Transaction Notification (ITN) Webhook (FR-060, FR-055).
 * Receives server-to-server payment confirmation from PayFast, verifies signature,
 * marks Payment VERIFIED, issues receipt, and confirms booking.
 */
export async function POST(req: Request) {
  const formText = await req.text();
  const params = new URLSearchParams(formText);
  const data: Record<string, string> = {};
  const withoutSig: Record<string, string> = {};

  for (const [k, v] of params.entries()) {
    data[k] = v;
    if (k !== "signature") withoutSig[k] = v;
  }

  const cfg = getPayFastConfig();
  const expectedSig = signPayFastPayload(withoutSig, cfg.passphrase);
  if (data.signature && data.signature !== expectedSig) {
    return NextResponse.json({ error: "Invalid PayFast signature" }, { status: 400 });
  }

  const paymentId = data.m_payment_id;
  const paymentStatus = data.payment_status;
  if (!paymentId) {
    return NextResponse.json({ error: "Missing m_payment_id" }, { status: 400 });
  }

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (paymentStatus === "COMPLETE" && payment.status !== "VERIFIED") {
    const receiptNo = `RCP-PF-${Date.now().toString(36).toUpperCase()}`;
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        receiptNo,
        note: `PayFast TX #${data.pf_payment_id ?? "ITN"}`,
      },
    });

    const newPaid = payment.booking.amountPaid + payment.amount;
    const fullyPaid = newPaid >= payment.booking.agreedTotal;
    const nextStatus =
      fullyPaid && (payment.booking.status === "AWAITING_PAYMENT" || payment.booking.status === "APPROVED")
        ? "CONFIRMED"
        : payment.booking.status;

    await db.booking.update({
      where: { id: payment.bookingId },
      data: {
        amountPaid: newPaid,
        paymentStatus: fullyPaid ? "PAID" : "PARTIAL",
        status: nextStatus,
      },
    });
  }

  return new NextResponse("OK", { status: 200 });
}
