import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, getSessionUser } from "@/lib/auth";
import { getAvailability } from "@/lib/availability";
import { quoteStay } from "@/lib/pricing";
import { saveBookingToSyncCookie } from "@/lib/serverless-sync";

function redirect303(req: Request, targetPath: string) {
  return NextResponse.redirect(new URL(targetPath, req.url), { status: 303 });
}

const bookingSchema = z.object({
  residenceSlug: z.string().min(1),
  roomType: z.enum(["SINGLE", "DOUBLE", "SHARING"]),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  occupants: z.coerce.number().int().min(1),
  bookingType: z.enum(["PUBLIC", "INSTITUTIONAL"]).default("PUBLIC"),
  eventName: z.string().trim().optional(),
  specialPreference: z.string().trim().optional(),
  emergencyName: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  idNumber: z.string().trim().optional(),
  rulesAccepted: z.string().optional(),
});

async function ensureAllocationsForBooking(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { allocations: { where: { isActive: true } } },
  });
  if (!booking || booking.allocations.length >= booking.occupants) return;

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

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return redirect303(req, "/login");
    }

    const formData = await req.formData();
    const intent = String(formData.get("intent") ?? "create");

    // 1. CREATE BOOKING OR SAVE DRAFT
    if (intent === "create") {
      const raw = Object.fromEntries(formData);
      const isDraft = formData.get("submitMode") === "DRAFT";
      const backQs = new URLSearchParams({
        residence: String(raw.residenceSlug ?? ""),
        type: String(raw.roomType ?? "SINGLE"),
        checkIn: String(raw.checkIn ?? ""),
        checkOut: String(raw.checkOut ?? ""),
        occupants: String(raw.occupants ?? "1"),
      }).toString();

      const parsed = bookingSchema.safeParse(raw);
      if (!parsed.success) {
        return redirect303(
          req,
          `/book?${backQs}&error=${encodeURIComponent("Please select valid stay dates, room type, and residence.")}`,
        );
      }
      const d = parsed.data;

      if (!isDraft) {
        if (!d.idNumber || !d.emergencyName || !d.emergencyPhone) {
          return redirect303(
            req,
            `/book?${backQs}&error=${encodeURIComponent("Please provide your ID/Passport number and emergency contact details.")}`,
          );
        }
        if (d.rulesAccepted !== "on") {
          return redirect303(
            req,
            `/book?${backQs}&error=${encodeURIComponent("Please accept the DUT Student Housing residence rules to submit your booking.")}`,
          );
        }
      }

      const checkIn = new Date(d.checkIn);
      const checkOut = new Date(d.checkOut);

      const residence = await db.residence.findUnique({ where: { slug: d.residenceSlug } });
      if (!residence) {
        return redirect303(req, `/search?error=${encodeURIComponent("Selected residence could not be found.")}`);
      }

      if (!isDraft && d.bookingType === "PUBLIC") {
        const periods = await db.bookingPeriod.findMany({ where: { isActive: true } });
        const month = checkIn.getMonth();
        const isHolidayMonth = month === 5 || month === 6 || month === 10 || month === 11 || month === 0;
        const inside =
          isHolidayMonth || periods.some((p) => checkIn >= p.startDate && checkOut <= p.endDate);
        if (!inside) {
          return redirect303(
            req,
            `/book?${backQs}&error=${encodeURIComponent("Public bookings are only permitted within approved June and December holiday periods.")}`,
          );
        }
      }

      const rooms = await getAvailability(residence.id, checkIn, checkOut);
      const freeBedsForType = rooms
        .filter((r) => r.type === d.roomType)
        .reduce((sum, r) => sum + r.freeBeds, 0);
      if (!isDraft && freeBedsForType < d.occupants) {
        return redirect303(
          req,
          `/book?${backQs}&error=${encodeURIComponent(`Insufficient availability: only ${freeBedsForType} beds free for this room type.`)}`,
        );
      }

      const quote = await quoteStay({
        residenceId: residence.id,
        roomType: d.roomType,
        checkIn,
        checkOut,
        occupants: d.occupants,
      });
      if (!quote.ok) {
        return redirect303(req, `/book?${backQs}&error=${encodeURIComponent(quote.error)}`);
      }

      const dbUser = (await db.user.findUnique({ where: { id: user.id } })) ?? {
        firstName: user.name.split(" ")[0] || "Guest",
        lastName: user.name.split(" ").slice(1).join(" ") || "User",
        email: user.email,
        phone: null,
        institution: null,
      };
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
              idNumber: d.idNumber || "Pending",
              institution: dbUser.institution,
              emergencyName: d.emergencyName || "Pending",
              emergencyPhone: d.emergencyPhone || "Pending",
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
        action: isDraft ? "booking.save_draft" : "booking.create",
        entity: "Booking",
        entityId: booking.id,
        after: { reference: booking.reference, status: booking.status, agreedTotal: booking.agreedTotal },
      });

      await db.notification.create({
        data: {
          toEmail: user.email,
          subject: isDraft ? `Draft Booking ${booking.reference} saved` : `Booking ${booking.reference} submitted`,
          body: `Your booking at ${residence.name} (${d.checkIn} to ${d.checkOut}) is now ${initialStatus}.`,
        },
      });

      await saveBookingToSyncCookie(booking.id);
      revalidatePath("/account");
      revalidatePath("/admin/bookings");

      if (isDraft) {
        return redirect303(req, `/account/bookings/${booking.id}?saved=draft`);
      }
      if (initialStatus === "AWAITING_PAYMENT") {
        return redirect303(req, `/account/bookings/${booking.id}?submitted=payment#payment`);
      }
      return redirect303(req, `/account/bookings/${booking.id}?submitted=review`);
    }

    // 2. SUBMIT DRAFT BOOKING
    if (intent === "submit-draft") {
      const bookingId = String(formData.get("bookingId"));
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { preferences: true },
      });
      if (!booking || booking.userId !== user.id) {
        return redirect303(req, "/account");
      }

      const rooms = await getAvailability(booking.residenceId, booking.checkIn, booking.checkOut, booking.id);
      const freeBeds = rooms
        .filter((r) => !booking.roomType || r.type === booking.roomType)
        .reduce((sum, r) => sum + r.freeBeds, 0);
      if (freeBeds < booking.occupants) {
        return redirect303(
          req,
          `/account/bookings/${bookingId}?error=${encodeURIComponent(`Cannot submit draft: only ${freeBeds} beds are available for the selected dates.`)}`,
        );
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

      await saveBookingToSyncCookie(bookingId);
      revalidatePath(`/account/bookings/${bookingId}`);
      revalidatePath("/admin/bookings");

      if (nextStatus === "AWAITING_PAYMENT") {
        return redirect303(req, `/account/bookings/${bookingId}?submitted=payment#payment`);
      }
      return redirect303(req, `/account/bookings/${bookingId}?submitted=review`);
    }

    // 3. SUBMIT PAYMENT (ONLINE GATEWAY OR EFT)
    if (intent === "pay") {
      const bookingId = String(formData.get("bookingId"));
      const methodRaw = String(formData.get("method") ?? "PAYFAST");
      const method = ["EFT", "PAYFAST", "OZOW", "PEACH", "ONLINE"].includes(methodRaw)
        ? methodRaw
        : "PAYFAST";
      const amount = Number(formData.get("amount"));
      let proofUrl = String(formData.get("proofUrl") ?? "").trim() || null;

      const booking = await db.booking.findUnique({ where: { id: bookingId } });
      if (!booking || booking.userId !== user.id) {
        return redirect303(req, "/account");
      }
      if (!amount || amount <= 0) {
        return redirect303(
          req,
          `/account/bookings/${bookingId}?error=${encodeURIComponent("Enter a valid payment amount.")}`,
        );
      }

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

        await saveBookingToSyncCookie(booking.id);
        return redirect303(req, `/account/bookings/${booking.id}/checkout?paymentId=${payment.id}`);
      }

      const popFile = formData.get("popFile");
      if (popFile instanceof File && popFile.size > 0) {
        const ext = path.extname(popFile.name).toLowerCase() || ".pdf";
        const safeName = `${booking.reference ?? booking.id}-${Date.now()}${ext}`.replace(/[^a-zA-Z0-9._-]/g, "");
        try {
          const dir = path.join(process.cwd(), "public", "uploads", "pop");
          await fs.mkdir(dir, { recursive: true });
          const bytes = Buffer.from(await popFile.arrayBuffer());
          await fs.writeFile(path.join(dir, safeName), bytes);
          proofUrl = `/uploads/pop/${safeName}`;
        } catch {
          proofUrl = proofUrl || `Uploaded: ${popFile.name} (${Math.max(1, Math.ceil(popFile.size / 1024))} KB)`;
        }
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

      await saveBookingToSyncCookie(booking.id);
      revalidatePath(`/account/bookings/${booking.id}`);
      revalidatePath("/admin/bookings");
      return redirect303(req, `/account/bookings/${booking.id}?submitted=eft`);
    }

    // 4. COMPLETE ONLINE GATEWAY PAYMENT
    if (intent === "complete-gateway") {
      const paymentId = String(formData.get("paymentId"));
      const payment = await db.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
      });
      if (!payment || payment.booking.userId !== user.id) {
        return redirect303(req, "/account");
      }

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

      await saveBookingToSyncCookie(payment.bookingId);
      revalidatePath(`/account/bookings/${payment.bookingId}`);
      revalidatePath("/admin/bookings");
      return redirect303(req, `/account/bookings/${payment.bookingId}?paid=1`);
    }

    // 5. AMEND BOOKING
    if (intent === "amend") {
      const bookingId = String(formData.get("bookingId"));
      const newCheckIn = new Date(String(formData.get("checkIn")));
      const newCheckOut = new Date(String(formData.get("checkOut")));
      const newOccupants = Math.max(1, Number(formData.get("occupants")));

      const before = await db.booking.findUnique({ where: { id: bookingId } });
      if (!before || before.userId !== user.id) {
        return redirect303(req, "/account");
      }

      const rooms = await getAvailability(before.residenceId, newCheckIn, newCheckOut, bookingId);
      const freeBeds = rooms
        .filter((r) => !before.roomType || r.type === before.roomType)
        .reduce((sum, r) => sum + r.freeBeds, 0);
      if (freeBeds < newOccupants) {
        return redirect303(
          req,
          `/account/bookings/${bookingId}?error=${encodeURIComponent(`Cannot amend: only ${freeBeds} beds available for the requested dates/occupants.`)}`,
        );
      }

      const quote = await quoteStay({
        residenceId: before.residenceId,
        roomType: before.roomType ?? undefined,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        occupants: newOccupants,
      });
      if (!quote.ok) {
        return redirect303(req, `/account/bookings/${bookingId}?error=${encodeURIComponent(quote.error)}`);
      }

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

      await saveBookingToSyncCookie(bookingId);
      revalidatePath(`/account/bookings/${bookingId}`);
      revalidatePath("/admin/bookings");
      return redirect303(req, `/account/bookings/${bookingId}`);
    }

    // 6. CANCEL BOOKING
    if (intent === "cancel") {
      const bookingId = String(formData.get("bookingId"));
      const reason = String(formData.get("reason") ?? "Cancelled by guest").trim() || "Cancelled by guest";
      const booking = await db.booking.findUnique({ where: { id: bookingId } });
      if (!booking || booking.userId !== user.id) {
        return redirect303(req, "/account");
      }

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

      await saveBookingToSyncCookie(bookingId);
      revalidatePath(`/account/bookings/${bookingId}`);
      revalidatePath("/account");
      return redirect303(req, `/account/bookings/${bookingId}`);
    }

    return redirect303(req, "/account");
  } catch (err) {
    console.error("[api/bookings] Error handling booking action:", err);
    return redirect303(req, `/account?error=${encodeURIComponent("Could not complete booking action. Please try again.")}`);
  }
}
