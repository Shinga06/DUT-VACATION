// Allowed values for string "enum" columns (SQLite has no native enums).

export const ROOM_TYPES = ["SINGLE", "DOUBLE", "SHARING"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  SHARING: "Multiple sharing",
};

export const ROOM_OP_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "CLEANING",
  "UNDER_MAINTENANCE",
  "OUT_OF_SERVICE",
] as const;
export type RoomOpStatus = (typeof ROOM_OP_STATUSES)[number];

export const BOOKING_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "CHECKED_IN",
  "CHECKED_OUT",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Statuses whose allocations hold inventory (BR-005, BR-006, BR-014).
// DRAFT never holds inventory. Checked-out still holds until staff release.
export const INVENTORY_HOLDING_STATUSES: BookingStatus[] = [
  "APPROVED",
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "CHECKED_IN",
];

export const SEASONS = ["JUNE", "DECEMBER", "INSTITUTIONAL"] as const;
export type Season = (typeof SEASONS)[number];

export const SYSTEM_ROLES = [
  "Super Administrator",
  "Student Housing Administrator",
  "Finance Officer",
  "Accommodation Officer",
  "Institutional Coordinator",
  "Public Guest",
] as const;

export const SESSION_COOKIE = "dutamp_session";
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
