"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, requirePermission, requireUser } from "@/lib/auth";
import { getAvailability } from "@/lib/availability";
import { quoteStay } from "@/lib/pricing";

const bookingSchema = z.object({
  residenceSlug: z.string().min(1),
  roomType: z.enum(["SINGLE", "DOUBLE", "SHARING"]),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  occupants: z.coerce.number().int().min(1),
  bookingType: z.enum(["PUBLIC", "INSTITUTIONAL"]).default("PUBLIC"),
  eventName: z.string().trim().optional(),
  specialPreference: z.string().trim().optional(),
  emergencyName: z.string().trim().min(2),
  emergencyPhone: z.string().trim().min(5),
  idNumber: z.string().trim().min(4),
  rulesAccepted: z.literal("on"),
});

export async function createBooking(formData: FormData) {
  const user = await requireUser();
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("Please complete all required fields and accept the residence rules.");
  }
  const d = parsed.data;
  const checkIn = new Date(d.checkIn);
  const checkOut = new Date(d.checkOut);

  const residence = await db.residence.findUniqueOrThrow({ where: { slug: d.residenceSlug } });

  // FR-026 / BR-002: Public bookings restricted to approved seasonal periods
  if (d.bookingType === "PUBLIC") {
    const periods = await db.bookingPeriod.findMany({ where: { isActive: true } });
    const inside = periods.some((p) => checkIn >= p.startDate && checkOut <= p.endDate);
    if (!inside) {
      throw new Error("Public bookings are only permitted within approved June and December holiday periods.");
    }
  }

  // FR-028 / BR-007: Validate availability in selected residence
  const rooms = await getAvailability(residence.id, checkIn, checkOut);
  const freeBedsForType = rooms
    .filter((r) => r.type === d.roomType)
    .reduce((sum, r) => sum + r.freeBeds, 0);
  if (freeBedsForType < d.occupants) {
    throw new Error(`Insufficient availability: only ${freeBedsForType} beds free for this room type.`);
  }

  // FR-020 / BR-010: Lock in agreed price snapshot
  const quote = await quoteStay({
    residenceId: residence.id,
    roomType: d.roomType,
    checkIn,
    checkOut,
    occupants: d.occupants,
  });
  if (!quote.ok) throw new Error(quote.error);

  const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const isDraft = formData.get("submitMode") === "DRAFT";
  const needsReview = d.bookingType === "INSTITUTIONAL" || d.occupants >= 5 || !!d.specialPreference;
  const initialStatus = isDraft ? "DRAFT" : needsReview ? "PENDING_REVIEW" : "AWAITING_PAYMENT";
  const refCode = `DUT-${Date.now().toString(36).toUpperCase()}`;

  const booking = await db.booking.create({
    data: {
      reference: refCode,
      type: d.bookingType,
      status: initialStatus,
      paymentStatus: "UNPAID",
      userId: user.id,
      residenceId: residence.id,
      checkIn,
      checkOut,
      occupants: d.occupants,
      roomType: d.roomType,
      institution: dbUser.institution,
      eventName: d.eventName || null,
      agreedTotal: quote.total,
      guests: {
        create: {
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          email: dbUser.email,
          phone: dbUser.phone,
          idNumber: d.idNumber,
          institution: dbUser.institution,
          emergencyName: d.emergencyName,
          emergencyPhone: d.emergencyPhone,
          rulesAcceptedAt: new Date(),
          detailsConfirmedAt: new Date(),
        },
      },
      ...(d.specialPreference
        ? {
            preferences: {
              create: {
                kind: "SPECIAL",
                details: d.specialPreference,
                status: "PENDING",
              },
            },
          }
        : {}),
    },
  });

  await audit({
    actorId: user.id,
    action: "booking.create",
    entity: "Booking",
    entityId: booking.id,
    after: { reference: booking.reference, status: booking.status, agreedTotal: booking.agreedTotal },
  });

  await db.notification.create({
    data: {
      toEmail: user.email,
      subject: `Booking ${booking.reference} submitted`,
      body: `Your booking at ${residence.name} (${d.checkIn} to ${d.checkOut}) is now ${initialStatus}.`,
    },
  });

  redirect(`/account/bookings/${booking.id}`);
}

/** Submit a saved DRAFT booking after validating live availability (FR-028, FR-029). */
export async function submitDraftBooking(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId"));
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { preferences: true },
  });
  if (booking.userId !== user.id) throw new Error("Unauthorised");

  const rooms = await getAvailability(booking.residenceId, booking.checkIn, booking.checkOut, booking.id);
  const freeBeds = rooms
    .filter((r) => !booking.roomType || r.type === booking.roomType)
    .reduce((sum, r) => sum + r.freeBeds, 0);
  if (freeBeds < booking.occupants) {
    throw new Error(`Cannot submit draft: only ${freeBeds} beds are available for the selected dates.`);
  }

  const needsReview =
    booking.type === "INSTITUTIONAL" || booking.occupants >= 5 || booking.preferences.length > 0;
  const nextStatus = needsReview ? "PENDING_REVIEW" : "AWAITING_PAYMENT";

  await db.booking.update({
    where: { id: bookingId },
    data: { status: nextStatus },
  });

  await audit({
    actorId: user.id,
    action: "booking.submit_draft",
    entity: "Booking",
    entityId: bookingId,
    before: { status: "DRAFT" },
    after: { status: nextStatus },
  });

  revalidatePath(`/account/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
}

/** Allocate free beds automatically for a booking inside a transaction (FR-014, FR-045). */
async function ensureAllocationsForBooking(bookingId: string) {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { allocations: { where: { isActive: true } } },
  });
  if (booking.allocations.length >= booking.occupants) return;

  const rooms = await db.room.findMany({
    where: {
      residenceId: booking.residenceId,
      isActive: true,
      ...(booking.roomType ? { type: booking.roomType } : {}),
      opStatus: { notIn: ["UNDER_MAINTENANCE", "OUT_OF_SERVICE"] },
    },
    include: {
      beds: { where: { isActive: true } },
      allocations: {
        where: {
          isActive: true,
          startDate: { lt: booking.checkOut },
          endDate: { gt: booking.checkIn },
        },
      },
    },
    orderBy: { roomNumber: "asc" },
  });

  let needed = booking.occupants - booking.allocations.length;
  for (const r of rooms) {
    if (needed <= 0) break;
    const takenBedIds = new Set(r.allocations.map((a) => a.bedId));
    for (const bed of r.beds) {
      if (needed <= 0) break;
      if (takenBedIds.has(bed.id)) continue;
      await db.allocation.create({
        data: {
          bookingId: booking.id,
          roomId: r.id,
          bedId: bed.id,
          startDate: booking.checkIn,
          endDate: booking.checkOut,
          isActive: true,
        },
      });
      needed--;
    }
  }
}

export async function submitPayment(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId"));
  const method = z
    .enum(["EFT", "PAYFAST", "OZOW", "PEACH", "ONLINE"])
    .parse(formData.get("method"));
  const amount = Number(formData.get("amount"));
  let proofUrl = String(formData.get("proofUrl") ?? "").trim() || null;

  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.userId !== user.id) throw new Error("Unauthorised");
  if (!amount || amount <= 0) throw new Error("Enter a valid payment amount.");

  const reference = `${booking.reference ?? booking.id.slice(0, 8)}-PAY`;

  if (method !== "EFT") {
    const gatewayMethod = method === "ONLINE" ? "PAYFAST" : method;
    const payment = await db.payment.create({
      data: {
        bookingId: booking.id,
        method: gatewayMethod,
        amount,
        reference,
        status: "PENDING",
      },
    });

    await audit({
      actorId: user.id,
      action: `payment.gateway_init.${gatewayMethod.toLowerCase()}`,
      entity: "Booking",
      entityId: booking.id,
      after: { method: gatewayMethod, amount, reference, paymentId: payment.id },
    });

    redirect(`/account/bookings/${booking.id}/checkout?paymentId=${payment.id}`);
  }

  // EFT Proof of Payment file upload or reference note
  const popFile = formData.get("popFile");
  if (popFile instanceof File && popFile.size > 0) {
    const ext = path.extname(popFile.name).toLowerCase() || ".pdf";
    const safeName = `${booking.reference ?? booking.id}-${Date.now()}${ext}`.replace(/[^a-zA-Z0-9._-]/g, "");
    const dir = path.join(process.cwd(), "public", "uploads", "pop");
    await fs.mkdir(dir, { recursive: true });
    const bytes = Buffer.from(await popFile.arrayBuffer());
    await fs.writeFile(path.join(dir, safeName), bytes);
    proofUrl = `/uploads/pop/${safeName}`;
  }

  await db.payment.create({
    data: {
      bookingId: booking.id,
      method: "EFT",
      amount,
      reference,
      proofUrl: proofUrl || "EFT Proof Uploaded",
      status: "PENDING",
    },
  });
  await db.booking.update({
    where: { id: booking.id },
    data: { paymentStatus: "PENDING_VERIFICATION" },
  });

  await audit({
    actorId: user.id,
    action: "payment.submit.eft",
    entity: "Booking",
    entityId: booking.id,
    after: { method: "EFT", amount, reference, proofUrl },
  });

  revalidatePath(`/account/bookings/${booking.id}`);
  revalidatePath("/admin/bookings");
}

/** Complete & verify an online gateway payment (PayFast / Ozow / Peach return callback). */
export async function completeGatewayPayment(formData: FormData) {
  const user = await requireUser();
  const paymentId = String(formData.get("paymentId"));
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { booking: true },
  });
  if (payment.booking.userId !== user.id) throw new Error("Unauthorised");

  if (payment.status !== "VERIFIED") {
    const receiptNo = `RCP-${payment.method.slice(0, 2)}-${Date.now().toString(36).toUpperCase()}`;
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        receiptNo,
        note: `${payment.method} Gateway Approved`,
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

    if (nextStatus === "CONFIRMED") {
      await ensureAllocationsForBooking(payment.bookingId);
    }

    await audit({
      actorId: user.id,
      action: `payment.gateway_verified.${payment.method.toLowerCase()}`,
      entity: "Payment",
      entityId: payment.id,
      after: { receiptNo, amount: payment.amount },
    });
  }

  revalidatePath(`/account/bookings/${payment.bookingId}`);
  revalidatePath("/admin/bookings");
  redirect(`/account/bookings/${payment.bookingId}`);
}

export async function verifyPayment(formData: FormData) {
  const user = await requirePermission("payments.verify");
  const paymentId = String(formData.get("paymentId"));
  const decision = z.enum(["VERIFIED", "REJECTED"]).parse(formData.get("decision"));

  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { booking: true },
  });

  const receiptNo = decision === "VERIFIED" ? `RCP-${Date.now().toString(36).toUpperCase()}` : null;
  await db.payment.update({
    where: { id: paymentId },
    data: {
      status: decision,
      verifiedById: user.id,
      verifiedAt: new Date(),
      receiptNo,
    },
  });

  if (decision === "VERIFIED") {
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

    if (nextStatus === "CONFIRMED") {
      await ensureAllocationsForBooking(payment.bookingId);
    }
  } else {
    await db.booking.update({
      where: { id: payment.bookingId },
      data: { paymentStatus: payment.booking.amountPaid > 0 ? "PARTIAL" : "UNPAID" },
    });
  }

  await audit({
    actorId: user.id,
    action: `payment.${decision.toLowerCase()}`,
    entity: "Payment",
    entityId: paymentId,
    after: { decision, receiptNo },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/account/bookings/${payment.bookingId}`);
}

export async function reviewBooking(formData: FormData) {
  const user = await requirePermission("bookings.review");
  const bookingId = String(formData.get("bookingId"));
  const decision = z
    .enum(["APPROVED", "REJECTED", "REQUEST_INFO"])
    .parse(formData.get("decision"));
  const infoMessage = String(formData.get("infoMessage") ?? "").trim();

  const before = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { user: true },
  });

  if (decision === "REQUEST_INFO") {
    const noteEntry = `[Housing Request: ${infoMessage || "Please confirm delegate roster / event details"}]`;
    const notes = before.notes ? `${before.notes} | ${noteEntry}` : noteEntry;
    await db.booking.update({
      where: { id: bookingId },
      data: { notes },
    });
    await db.notification.create({
      data: {
        toEmail: before.user.email,
        subject: `Additional Information Requested (${before.reference})`,
        body: infoMessage || "Student Housing has requested additional information regarding your booking.",
      },
    });
    await audit({
      actorId: user.id,
      action: "booking.request_info",
      entity: "Booking",
      entityId: bookingId,
      after: { infoMessage },
    });
    revalidatePath("/admin/bookings");
    revalidatePath(`/account/bookings/${bookingId}`);
    return;
  }

  const nextStatus =
    decision === "APPROVED"
      ? before.amountPaid >= before.agreedTotal
        ? "CONFIRMED"
        : "AWAITING_PAYMENT"
      : "REJECTED";

  await db.booking.update({
    where: { id: bookingId },
    data: { status: nextStatus },
  });

  if (decision === "APPROVED") {
    await ensureAllocationsForBooking(bookingId);
  }

  await db.notification.create({
    data: {
      toEmail: before.user.email,
      subject: `Booking ${before.reference} ${decision}`,
      body:
        decision === "APPROVED"
          ? `Your booking request (${before.reference}) has been approved by Student Housing. You may now proceed with payment.`
          : `Your booking request (${before.reference}) could not be approved.`,
    },
  });

  await audit({
    actorId: user.id,
    action: `booking.${decision.toLowerCase()}`,
    entity: "Booking",
    entityId: bookingId,
    before: { status: before.status },
    after: { status: nextStatus },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/account/bookings/${bookingId}`);
}

export async function replyToInfoRequest(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId"));
  const reply = String(formData.get("reply") ?? "").trim();
  if (!reply) throw new Error("Please enter your response.");

  const before = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (before.userId !== user.id) throw new Error("Unauthorised");

  const noteEntry = `[Guest Reply: ${reply}]`;
  const notes = before.notes ? `${before.notes} | ${noteEntry}` : noteEntry;
  await db.booking.update({
    where: { id: bookingId },
    data: { notes },
  });

  await audit({
    actorId: user.id,
    action: "booking.info_reply",
    entity: "Booking",
    entityId: bookingId,
    after: { reply },
  });

  revalidatePath(`/account/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
}

export async function checkInOutBooking(formData: FormData) {
  const user = await requirePermission("checkin.manage");
  const bookingId = String(formData.get("bookingId"));
  const action = z.enum(["CHECK_IN", "CHECK_OUT"]).parse(formData.get("action"));

  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { allocations: { where: { isActive: true } }, guests: true },
  });

  if (action === "CHECK_IN") {
    await db.booking.update({ where: { id: bookingId }, data: { status: "CHECKED_IN" } });
    for (const a of booking.allocations) {
      await db.room.update({ where: { id: a.roomId }, data: { opStatus: "OCCUPIED" } });
    }
    for (const g of booking.guests) {
      await db.guest.update({ where: { id: g.id }, data: { actualArrival: new Date() } });
    }
  } else {
    // FR-096 / BR-014: Checkout sets rooms to CLEANING and creates cleaning tasks;
    // rooms are only offered again once staff mark them AVAILABLE.
    await db.booking.update({ where: { id: bookingId }, data: { status: "CHECKED_OUT" } });
    for (const a of booking.allocations) {
      await db.allocation.update({ where: { id: a.id }, data: { isActive: false } });
      await db.room.update({ where: { id: a.roomId }, data: { opStatus: "CLEANING" } });
      await db.cleaningTask.create({ data: { roomId: a.roomId, status: "PENDING" } });
    }
    for (const g of booking.guests) {
      await db.guest.update({ where: { id: g.id }, data: { actualDeparture: new Date() } });
    }
  }

  await audit({
    actorId: user.id,
    action: `booking.${action.toLowerCase()}`,
    entity: "Booking",
    entityId: bookingId,
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/account/bookings/${bookingId}`);
}

export async function cancelBooking(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId"));
  const reason = String(formData.get("reason") ?? "Cancelled by guest").trim();
  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.userId !== user.id) throw new Error("Unauthorised");

  // FR-072, FR-077: Calculate eligible refund based on configured CancellationPolicy
  let refundAmount = 0;
  if (booking.amountPaid > 0) {
    const daysBefore = Math.floor((booking.checkIn.getTime() - Date.now()) / 86_400_000);
    const policies = await db.cancellationPolicy.findMany({
      where: { isActive: true },
      orderBy: { daysBeforeStay: "desc" },
    });
    const matched = policies.find((p) => daysBefore >= p.daysBeforeStay);
    const pct = matched ? matched.refundPercent : 0;
    refundAmount = Math.round(booking.amountPaid * (pct / 100) * 100) / 100;
    if (refundAmount > 0) {
      await db.payment.create({
        data: {
          bookingId: booking.id,
          method: "EFT",
          kind: "REFUND",
          amount: -refundAmount,
          reference: `${booking.reference ?? booking.id.slice(0, 8)}-REFUND`,
          status: "VERIFIED",
          verifiedAt: new Date(),
          receiptNo: `RFD-${Date.now().toString(36).toUpperCase()}`,
          note: `${pct}% policy refund (${daysBefore}d before check-in)`,
        },
      });
    }
  }

  // FR-076: Approved cancellations release accommodation availability
  await db.allocation.updateMany({ where: { bookingId }, data: { isActive: false } });
  await db.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      cancellationReason: reason,
      ...(refundAmount > 0 ? { paymentStatus: "REFUNDED" } : {}),
    },
  });

  await audit({
    actorId: user.id,
    action: "booking.cancel",
    entity: "Booking",
    entityId: bookingId,
    after: { reason, refundAmount },
  });

  revalidatePath(`/account/bookings/${bookingId}`);
  revalidatePath("/account");
}

/** FR-078 to FR-082: Booking amendments with availability validation, cost recalculation & audit trail. */
export async function amendBooking(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId"));
  const newCheckIn = new Date(String(formData.get("checkIn")));
  const newCheckOut = new Date(String(formData.get("checkOut")));
  const newOccupants = Math.max(1, Number(formData.get("occupants")));

  const before = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (before.userId !== user.id) throw new Error("Unauthorised");

  // Validate availability excluding this booking's existing allocations (FR-079)
  const rooms = await getAvailability(before.residenceId, newCheckIn, newCheckOut, bookingId);
  const freeBeds = rooms
    .filter((r) => !before.roomType || r.type === before.roomType)
    .reduce((sum, r) => sum + r.freeBeds, 0);
  if (freeBeds < newOccupants) {
    throw new Error(`Cannot amend: only ${freeBeds} beds available for the requested dates/occupants.`);
  }

  // Recalculate cost (FR-080)
  const quote = await quoteStay({
    residenceId: before.residenceId,
    roomType: before.roomType ?? undefined,
    checkIn: newCheckIn,
    checkOut: newCheckOut,
    occupants: newOccupants,
  });
  if (!quote.ok) throw new Error(quote.error);

  // Release old allocations and re-allocate if confirmed/approved
  await db.allocation.updateMany({ where: { bookingId }, data: { isActive: false } });

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: {
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      occupants: newOccupants,
      agreedTotal: quote.total,
      paymentStatus:
        before.amountPaid >= quote.total
          ? "PAID"
          : before.amountPaid > 0
            ? "PARTIAL"
            : "UNPAID",
    },
  });

  if (["APPROVED", "CONFIRMED"].includes(updated.status)) {
    await ensureAllocationsForBooking(bookingId);
  }

  // FR-082: Retain previous booking information in audit history
  await audit({
    actorId: user.id,
    action: "booking.amend",
    entity: "Booking",
    entityId: bookingId,
    before: {
      checkIn: before.checkIn,
      checkOut: before.checkOut,
      occupants: before.occupants,
      agreedTotal: before.agreedTotal,
    },
    after: {
      checkIn: updated.checkIn,
      checkOut: updated.checkOut,
      occupants: updated.occupants,
      agreedTotal: updated.agreedTotal,
    },
  });

  revalidatePath(`/account/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
}

/**
 * FR-034, FR-035, FR-036: Bulk delegate registration via CSV upload/paste.
 * Expected columns: firstName,lastName,email,phone,studentOrStaffNo,arrivalDate,departureDate
 */
export async function uploadDelegatesCsv(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId"));
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { guests: true },
  });
  if (booking.userId !== user.id) throw new Error("Unauthorised");

  let csvText = String(formData.get("csvText") ?? "").trim();
  const file = formData.get("csvFile");
  if (file instanceof File && file.size > 0) {
    csvText = (await file.text()).trim();
  }
  if (!csvText) throw new Error("Provide CSV rows or upload a CSV file.");

  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const existingKeys = new Set(
    booking.guests
      .map((g) => (g.email ?? g.studentOrStaffNo ?? "").toLowerCase())
      .filter(Boolean),
  );
  const batchKeys = new Set<string>();
  const toCreate: {
    bookingId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    studentOrStaffNo: string | null;
    institution: string | null;
    arrivalDate: Date | null;
    departureDate: Date | null;
  }[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    // Skip header row if present
    if (i === 0 && cols[0]?.toLowerCase().includes("firstname")) continue;
    const [firstName, lastName, email, phone, studentOrStaffNo, arrivalStr, departureStr] = cols;
    if (!firstName || !lastName) {
      skipped.push(`Row ${i + 1}: missing firstName/lastName`);
      continue;
    }
    const dedupeKey = (email || studentOrStaffNo || `${firstName}-${lastName}`).toLowerCase();
    if (existingKeys.has(dedupeKey) || batchKeys.has(dedupeKey)) {
      skipped.push(`Row ${i + 1}: duplicate (${dedupeKey})`);
      continue;
    }
    batchKeys.add(dedupeKey);
    toCreate.push({
      bookingId,
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      studentOrStaffNo: studentOrStaffNo || null,
      institution: booking.institution,
      arrivalDate: arrivalStr ? new Date(arrivalStr) : booking.checkIn,
      departureDate: departureStr ? new Date(departureStr) : booking.checkOut,
    });
  }

  if (toCreate.length > 0) {
    await db.guest.createMany({ data: toCreate });
  }

  await audit({
    actorId: user.id,
    action: "delegates.bulk_upload",
    entity: "Booking",
    entityId: bookingId,
    after: { added: toCreate.length, skipped },
  });

  revalidatePath(`/account/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
}

/** FR-115 to FR-117: Guest submits post-stay accommodation feedback. */
export async function submitFeedback(formData: FormData) {
  const user = await requireUser();
  const bookingId = String(formData.get("bookingId"));
  const rating = z.coerce.number().int().min(1).max(5).parse(formData.get("rating"));
  const cleanliness = z.coerce.number().int().min(1).max(5).parse(formData.get("cleanliness"));
  const facilities = z.coerce.number().int().min(1).max(5).parse(formData.get("facilities"));
  const service = z.coerce.number().int().min(1).max(5).parse(formData.get("service"));
  const comment = String(formData.get("comment") ?? "").trim() || null;

  const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.userId !== user.id) throw new Error("Unauthorised");

  await db.feedback.upsert({
    where: { bookingId },
    update: { rating, cleanliness, facilities, service, comment },
    create: { bookingId, rating, cleanliness, facilities, service, comment },
  });

  await audit({
    actorId: user.id,
    action: "feedback.submit",
    entity: "Booking",
    entityId: bookingId,
    after: { rating, cleanliness, facilities, service },
  });

  revalidatePath(`/account/bookings/${bookingId}`);
  revalidatePath("/admin/feedback");
}

/** FR-046 to FR-049: Manual room/bed allocation by Accommodation Officer. */
export async function manualAllocateRoom(formData: FormData) {
  const user = await requirePermission("allocations.manage");
  const bookingId = String(formData.get("bookingId"));
  const roomId = String(formData.get("roomId"));

  const [booking, room] = await Promise.all([
    db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { allocations: { where: { isActive: true } } },
    }),
    db.room.findUniqueOrThrow({
      where: { id: roomId },
      include: {
        beds: { where: { isActive: true } },
        allocations: {
          where: { isActive: true },
        },
      },
    }),
  ]);

  const takenBeds = new Set(room.allocations.map((a) => a.bedId));
  const freeBed = room.beds.find((b) => !takenBeds.has(b.id));
  if (!freeBed) throw new Error(`Room ${room.roomNumber} has no free beds.`);

  const created = await db.allocation.create({
    data: {
      bookingId: booking.id,
      roomId: room.id,
      bedId: freeBed.id,
      startDate: booking.checkIn,
      endDate: booking.checkOut,
      isActive: true,
    },
  });

  await audit({
    actorId: user.id,
    action: "allocation.manual",
    entity: "Allocation",
    entityId: created.id,
    after: { bookingId, roomNumber: room.roomNumber, bed: freeBed.label },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/account/bookings/${bookingId}`);
}

/** FR-052 to FR-054: Review and update accommodation preference status. */
export async function updatePreferenceStatus(formData: FormData) {
  const user = await requirePermission("allocations.manage");
  const id = String(formData.get("id"));
  const status = z
    .enum(["PENDING", "APPROVED", "PARTIALLY_ACCOMMODATED", "DECLINED"])
    .parse(formData.get("status"));
  const response = String(formData.get("response") ?? "").trim() || null;

  const pref = await db.preference.update({
    where: { id },
    data: { status, response },
    include: { booking: { include: { user: true } } },
  });

  if (status === "DECLINED" || status === "PARTIALLY_ACCOMMODATED") {
    await db.notification.create({
      data: {
        toEmail: pref.booking.user.email,
        subject: `Accommodation preference update (${pref.booking.reference})`,
        body: `Your preference "${pref.details}" is marked ${status}. ${response ?? ""}`,
      },
    });
  }

  await audit({
    actorId: user.id,
    action: "preference.update",
    entity: "Preference",
    entityId: id,
    after: { status, response },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/account/bookings/${pref.bookingId}`);
}

/** FR-094: Record no-shows, late arrivals, and early departures. */
export async function recordArrivalAnomaly(formData: FormData) {
  const user = await requirePermission("checkin.manage");
  const bookingId = String(formData.get("bookingId"));
  const anomaly = z.enum(["NO_SHOW", "LATE_ARRIVAL", "EARLY_DEPARTURE"]).parse(formData.get("anomaly"));

  const before = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const notes = `${before.notes ? before.notes + " | " : ""}[${anomaly} recorded ${new Date().toISOString().slice(0, 16)}]`;
  await db.booking.update({
    where: { id: bookingId },
    data: {
      notes,
      ...(anomaly === "NO_SHOW" ? { status: "CANCELLED", cancellationReason: "No-show" } : {}),
    },
  });

  if (anomaly === "NO_SHOW") {
    await db.allocation.updateMany({ where: { bookingId }, data: { isActive: false } });
  }

  await audit({
    actorId: user.id,
    action: `booking.${anomaly.toLowerCase()}`,
    entity: "Booking",
    entityId: bookingId,
    after: { anomaly },
  });

  revalidatePath("/admin/bookings");
}

