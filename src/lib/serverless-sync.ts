import "server-only";
import zlib from "node:zlib";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SYNC_COOKIE = "dutamp_bk_sync";
const MAX_SYNCED_BOOKINGS = 4;

type SyncedBooking = {
  id: string;
  reference: string | null;
  type: string;
  status: string;
  paymentStatus: string;
  userId: string;
  residenceId: string;
  checkIn: string;
  checkOut: string;
  occupants: number;
  roomType: string | null;
  institution: string | null;
  eventName: string | null;
  notes: string | null;
  agreedTotal: number;
  amountPaid: number;
  cancellationReason: string | null;
  createdAt: string;
  guests: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    idNumber: string | null;
    studentOrStaffNo: string | null;
    institution: string | null;
    arrivalDate: string | null;
    departureDate: string | null;
    emergencyName: string | null;
    emergencyPhone: string | null;
  }[];
  payments: {
    id: string;
    method: string;
    kind: string;
    amount: number;
    reference: string;
    proofUrl: string | null;
    status: string;
    verifiedAt: string | null;
    note: string | null;
    receiptNo: string | null;
    createdAt: string;
  }[];
  allocations: {
    id: string;
    roomId: string;
    bedId: string | null;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }[];
  preferences: {
    id: string;
    kind: string;
    details: string;
    status: string;
    response: string | null;
  }[];
  feedback: {
    id: string;
    rating: number;
    cleanliness: number | null;
    facilities: number | null;
    service: number | null;
    comment: string | null;
    reviewed: boolean;
  } | null;
};

function decodeCookie(raw: string | undefined): SyncedBooking[] {
  if (!raw) return [];
  try {
    const json = zlib.inflateRawSync(Buffer.from(raw, "base64url")).toString("utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function encodeCookie(list: SyncedBooking[]): string {
  const json = JSON.stringify(list.slice(0, MAX_SYNCED_BOOKINGS));
  return zlib.deflateRawSync(Buffer.from(json, "utf8"), { level: 9 }).toString("base64url");
}

/**
 * Persist a compact compressed snapshot of the booking in an HTTP-only cookie
 * so stateless serverless instances (e.g. Vercel lambdas with separate /tmp)
 * stay 100% consistent across redirects.
 */
export async function saveBookingToSyncCookie(bookingId: string) {
  try {
    const b = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        guests: true,
        payments: true,
        allocations: true,
        preferences: true,
        feedback: true,
      },
    });
    if (!b) return;

    const snapshot: SyncedBooking = {
      id: b.id,
      reference: b.reference,
      type: b.type,
      status: b.status,
      paymentStatus: b.paymentStatus,
      userId: b.userId,
      residenceId: b.residenceId,
      checkIn: b.checkIn.toISOString(),
      checkOut: b.checkOut.toISOString(),
      occupants: b.occupants,
      roomType: b.roomType,
      institution: b.institution,
      eventName: b.eventName,
      notes: b.notes,
      agreedTotal: b.agreedTotal,
      amountPaid: b.amountPaid,
      cancellationReason: b.cancellationReason,
      createdAt: b.createdAt.toISOString(),
      guests: b.guests.map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        email: g.email,
        phone: g.phone,
        idNumber: g.idNumber,
        studentOrStaffNo: g.studentOrStaffNo,
        institution: g.institution,
        arrivalDate: g.arrivalDate ? g.arrivalDate.toISOString() : null,
        departureDate: g.departureDate ? g.departureDate.toISOString() : null,
        emergencyName: g.emergencyName,
        emergencyPhone: g.emergencyPhone,
      })),
      payments: b.payments.map((p) => ({
        id: p.id,
        method: p.method,
        kind: p.kind,
        amount: p.amount,
        reference: p.reference,
        proofUrl: p.proofUrl,
        status: p.status,
        verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
        note: p.note,
        receiptNo: p.receiptNo,
        createdAt: p.createdAt.toISOString(),
      })),
      allocations: b.allocations.map((a) => ({
        id: a.id,
        roomId: a.roomId,
        bedId: a.bedId,
        startDate: a.startDate.toISOString(),
        endDate: a.endDate.toISOString(),
        isActive: a.isActive,
      })),
      preferences: b.preferences.map((pr) => ({
        id: pr.id,
        kind: pr.kind,
        details: pr.details,
        status: pr.status,
        response: pr.response,
      })),
      feedback: b.feedback
        ? {
            id: b.feedback.id,
            rating: b.feedback.rating,
            cleanliness: b.feedback.cleanliness,
            facilities: b.feedback.facilities,
            service: b.feedback.service,
            comment: b.feedback.comment,
            reviewed: b.feedback.reviewed,
          }
        : null,
    };

    const jar = await cookies();
    const existing = decodeCookie(jar.get(SYNC_COOKIE)?.value).filter((x) => x.id !== b.id);
    const updated = [snapshot, ...existing].slice(0, MAX_SYNCED_BOOKINGS);
    jar.set(SYNC_COOKIE, encodeCookie(updated), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 3600,
    });
  } catch (err) {
    console.error("[sync] Failed to save booking sync cookie:", err);
  }
}

/**
 * Reconcile any bookings stored in the sync cookie into the local SQLite database
 * so redirects across different serverless function instances never miss data.
 */
export async function syncBookingsFromCookie() {
  try {
    const jar = await cookies();
    const list = decodeCookie(jar.get(SYNC_COOKIE)?.value);
    if (list.length === 0) return;

    for (const b of list) {
      const [userExists, resExists] = await Promise.all([
        db.user.findUnique({ where: { id: b.userId }, select: { id: true } }),
        db.residence.findUnique({ where: { id: b.residenceId }, select: { id: true } }),
      ]);
      if (!userExists || !resExists) continue;

      await db.booking.upsert({
        where: { id: b.id },
        update: {
          status: b.status,
          paymentStatus: b.paymentStatus,
          checkIn: new Date(b.checkIn),
          checkOut: new Date(b.checkOut),
          occupants: b.occupants,
          notes: b.notes,
          agreedTotal: b.agreedTotal,
          amountPaid: b.amountPaid,
          cancellationReason: b.cancellationReason,
        },
        create: {
          id: b.id,
          reference: b.reference,
          type: b.type,
          status: b.status,
          paymentStatus: b.paymentStatus,
          userId: b.userId,
          residenceId: b.residenceId,
          checkIn: new Date(b.checkIn),
          checkOut: new Date(b.checkOut),
          occupants: b.occupants,
          roomType: b.roomType,
          institution: b.institution,
          eventName: b.eventName,
          notes: b.notes,
          agreedTotal: b.agreedTotal,
          amountPaid: b.amountPaid,
          cancellationReason: b.cancellationReason,
          createdAt: new Date(b.createdAt),
        },
      });

      for (const g of b.guests) {
        await db.guest.upsert({
          where: { id: g.id },
          update: {
            firstName: g.firstName,
            lastName: g.lastName,
            email: g.email,
            phone: g.phone,
            idNumber: g.idNumber,
            studentOrStaffNo: g.studentOrStaffNo,
            institution: g.institution,
            arrivalDate: g.arrivalDate ? new Date(g.arrivalDate) : null,
            departureDate: g.departureDate ? new Date(g.departureDate) : null,
          },
          create: {
            id: g.id,
            bookingId: b.id,
            firstName: g.firstName,
            lastName: g.lastName,
            email: g.email,
            phone: g.phone,
            idNumber: g.idNumber,
            studentOrStaffNo: g.studentOrStaffNo,
            institution: g.institution,
            arrivalDate: g.arrivalDate ? new Date(g.arrivalDate) : null,
            departureDate: g.departureDate ? new Date(g.departureDate) : null,
            emergencyName: g.emergencyName,
            emergencyPhone: g.emergencyPhone,
            rulesAcceptedAt: new Date(),
            detailsConfirmedAt: new Date(),
          },
        });
      }

      for (const p of b.payments) {
        await db.payment.upsert({
          where: { id: p.id },
          update: {
            status: p.status,
            verifiedAt: p.verifiedAt ? new Date(p.verifiedAt) : null,
            note: p.note,
            receiptNo: p.receiptNo,
          },
          create: {
            id: p.id,
            bookingId: b.id,
            method: p.method,
            kind: p.kind,
            amount: p.amount,
            reference: p.reference,
            proofUrl: p.proofUrl,
            status: p.status,
            verifiedAt: p.verifiedAt ? new Date(p.verifiedAt) : null,
            note: p.note,
            receiptNo: p.receiptNo,
            createdAt: new Date(p.createdAt),
          },
        });
      }

      for (const a of b.allocations) {
        const roomExists = await db.room.findUnique({ where: { id: a.roomId }, select: { id: true } });
        if (!roomExists) continue;
        await db.allocation.upsert({
          where: { id: a.id },
          update: { isActive: a.isActive },
          create: {
            id: a.id,
            bookingId: b.id,
            roomId: a.roomId,
            bedId: a.bedId,
            startDate: new Date(a.startDate),
            endDate: new Date(a.endDate),
            isActive: a.isActive,
          },
        });
      }

      for (const pr of b.preferences) {
        await db.preference.upsert({
          where: { id: pr.id },
          update: { status: pr.status, response: pr.response },
          create: {
            id: pr.id,
            bookingId: b.id,
            kind: pr.kind,
            details: pr.details,
            status: pr.status,
            response: pr.response,
          },
        });
      }

      if (b.feedback) {
        await db.feedback.upsert({
          where: { bookingId: b.id },
          update: {
            rating: b.feedback.rating,
            cleanliness: b.feedback.cleanliness,
            facilities: b.feedback.facilities,
            service: b.feedback.service,
            comment: b.feedback.comment,
            reviewed: b.feedback.reviewed,
          },
          create: {
            id: b.feedback.id,
            bookingId: b.id,
            rating: b.feedback.rating,
            cleanliness: b.feedback.cleanliness,
            facilities: b.feedback.facilities,
            service: b.feedback.service,
            comment: b.feedback.comment,
            reviewed: b.feedback.reviewed,
          },
        });
      }
    }
  } catch (err) {
    console.error("[sync] Failed to sync bookings from cookie:", err);
  }
}
