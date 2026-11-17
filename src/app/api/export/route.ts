import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.permissions, "dashboard.view")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "bookings";
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const residenceId = url.searchParams.get("residenceId") || undefined;
  const category = url.searchParams.get("category") || undefined;

  const fromDate = fromStr ? new Date(fromStr) : undefined;
  const toDate = toStr ? new Date(`${toStr}T23:59:59`) : undefined;

  const bookingFilter = {
    ...(residenceId ? { residenceId } : {}),
    ...(category ? { type: category } : {}),
    ...(fromDate || toDate
      ? {
          checkIn: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  if (kind === "audit") {
    if (!hasPermission(user.permissions, "audit.view")) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
    }
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { actor: true },
    });
    const rows = [
      ["Timestamp", "Actor", "Action", "Entity", "EntityId", "Before", "After"].join(","),
      ...logs.map((l) =>
        [
          l.createdAt.toISOString(),
          l.actor?.email ?? "system",
          l.action,
          l.entity,
          l.entityId ?? "",
          l.before ?? "",
          l.after ?? "",
        ]
          .map(esc)
          .join(","),
      ),
    ];
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="dut-amp-audit-log.csv"',
      },
    });
  }

  if (kind === "finance") {
    const payments = await db.payment.findMany({
      where: Object.keys(bookingFilter).length > 0 ? { booking: bookingFilter } : {},
      orderBy: { createdAt: "desc" },
      include: { booking: { include: { residence: true, user: true } } },
    });
    const rows = [
      ["Date", "BookingRef", "Category", "Residence", "Guest", "Method", "Kind", "Reference", "AmountZAR", "Status", "ReceiptNo"].join(","),
      ...payments.map((p) =>
        [
          p.createdAt.toISOString().slice(0, 10),
          p.booking.reference ?? "",
          p.booking.type,
          p.booking.residence.name,
          `${p.booking.user.firstName} ${p.booking.user.lastName}`,
          p.method,
          p.kind,
          p.reference,
          p.amount,
          p.status,
          p.receiptNo ?? "",
        ]
          .map(esc)
          .join(","),
      ),
    ];
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="dut-amp-finance-report.csv"',
      },
    });
  }

  const bookings = await db.booking.findMany({
    where: bookingFilter,
    orderBy: { createdAt: "desc" },
    include: { residence: true, user: true },
  });
  const rows = [
    ["Reference", "Category", "Residence", "Guest", "Institution", "CheckIn", "CheckOut", "Occupants", "Status", "PaymentStatus", "AgreedTotalZAR", "PaidZAR"].join(","),
    ...bookings.map((b) =>
      [
        b.reference ?? "",
        b.type,
        b.residence.name,
        `${b.user.firstName} ${b.user.lastName}`,
        b.institution ?? "",
        b.checkIn.toISOString().slice(0, 10),
        b.checkOut.toISOString().slice(0, 10),
        b.occupants,
        b.status,
        b.paymentStatus,
        b.agreedTotal,
        b.amountPaid,
      ]
        .map(esc)
        .join(","),
    ),
  ];
  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dut-amp-bookings-report.csv"',
    },
  });
}
