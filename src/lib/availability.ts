import { db } from "@/lib/db";
import { INVENTORY_HOLDING_STATUSES } from "@/lib/constants";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((startOfDay(checkOut).getTime() - startOfDay(checkIn).getTime()) / 86_400_000);
}

export type RoomAvailability = {
  roomId: string;
  roomNumber: string;
  type: string;
  totalBeds: number;
  freeBeds: number;
  isAccessible: boolean;
};

/** Rooms that may be offered for booking at all (FR-012, FR-013, FR-105). */
function isOfferable(room: {
  isActive: boolean;
  opStatus: string;
  restrictedUntil: Date | null;
}, checkIn: Date): boolean {
  if (!room.isActive) return false;
  if (room.opStatus === "UNDER_MAINTENANCE" || room.opStatus === "OUT_OF_SERVICE") return false;
  if (room.restrictedUntil && room.restrictedUntil > checkIn) return false;
  return true;
}

/**
 * Free beds per room for a date range. Public and institutional bookings share
 * this single inventory (FR-015, BR-004). Draft bookings never hold inventory
 * (FR-029, BR-006); scheduled checkout does not release it (BR-014) because
 * allocations only become inactive when staff release them.
 */
export async function getAvailability(
  residenceId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string,
): Promise<RoomAvailability[]> {
  const rooms = await db.room.findMany({
    where: { residenceId },
    include: {
      beds: true,
      allocations: {
        where: {
          isActive: true,
          startDate: { lt: checkOut },
          endDate: { gt: checkIn },
          booking: {
            status: { in: INVENTORY_HOLDING_STATUSES },
            ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          },
        },
      },
    },
    orderBy: { roomNumber: "asc" },
  });

  return rooms
    .filter((r) => isOfferable(r, checkIn))
    .map((r) => {
      const activeBeds = r.beds.filter((b) => b.isActive && !(b.restrictedUntil && b.restrictedUntil > checkIn));
      const totalBeds = r.beds.length > 0 ? activeBeds.length : r.capacity;
      const wholeRoomTaken = r.allocations.some((a) => a.bedId === null);
      const takenBeds = new Set(r.allocations.filter((a) => a.bedId).map((a) => a.bedId));
      const freeBeds = wholeRoomTaken
        ? 0
        : r.beds.length > 0
          ? activeBeds.filter((b) => !takenBeds.has(b.id)).length
          : totalBeds;
      return {
        roomId: r.id,
        roomNumber: r.roomNumber,
        type: r.type,
        totalBeds,
        freeBeds,
        isAccessible: r.isAccessible,
      };
    });
}

export type TypeAvailability = { type: string; freeBeds: number; freeRooms: number };

export function summariseByType(rooms: RoomAvailability[]): TypeAvailability[] {
  const map = new Map<string, TypeAvailability>();
  for (const r of rooms) {
    const entry = map.get(r.type) ?? { type: r.type, freeBeds: 0, freeRooms: 0 };
    entry.freeBeds += r.freeBeds;
    if (r.freeBeds === r.totalBeds && r.totalBeds > 0) entry.freeRooms += 1;
    map.set(r.type, entry);
  }
  return [...map.values()];
}

/**
 * Per-day availability for the calendar (FR-128, FR-130): free beds on each
 * night between `from` (inclusive) and `to` (exclusive).
 */
export async function getCalendar(
  residenceId: string,
  roomType: string | undefined,
  from: Date,
  to: Date,
): Promise<{ date: string; freeBeds: number }[]> {
  const days: { date: string; freeBeds: number }[] = [];
  const cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor < end) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    const rooms = await getAvailability(residenceId, new Date(cursor), next);
    const free = rooms
      .filter((r) => !roomType || r.type === roomType)
      .reduce((sum, r) => sum + r.freeBeds, 0);
    days.push({ date: cursor.toISOString().slice(0, 10), freeBeds: free });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
