// Permission keys for role-based access control (FR / NFR 5.1).
// Custom roles are built by combining these keys (SRS 3.2).

export const PERMISSIONS = {
  "users.manage": "Create, edit and deactivate users",
  "roles.manage": "Manage roles and permissions",
  "residences.manage": "Manage residences, rooms and beds",
  "pricing.manage": "Manage pricing and booking periods",
  "bookings.view": "View all bookings",
  "bookings.review": "Approve, reject or request info on bookings",
  "allocations.manage": "Allocate rooms and beds",
  "checkin.manage": "Check guests in and out",
  "payments.verify": "Verify EFT payments and issue receipts",
  "finance.reports": "View financial reports",
  "operations.manage": "Manage cleaning and maintenance",
  "feedback.review": "Review guest feedback",
  "audit.view": "View security and audit logs",
  "dashboard.view": "View the admin dashboard",
  "institutional.manage": "Manage institutional delegations",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  "Super Administrator": ALL_PERMISSIONS,
  "Student Housing Administrator": [
    "residences.manage",
    "pricing.manage",
    "bookings.view",
    "bookings.review",
    "allocations.manage",
    "checkin.manage",
    "operations.manage",
    "feedback.review",
    "dashboard.view",
    "institutional.manage",
    "finance.reports",
  ],
  "Finance Officer": [
    "bookings.view",
    "payments.verify",
    "finance.reports",
    "dashboard.view",
  ],
  "Accommodation Officer": [
    "bookings.view",
    "allocations.manage",
    "checkin.manage",
    "operations.manage",
    "dashboard.view",
  ],
  "Institutional Coordinator": ["institutional.manage"],
  "Public Guest": [],
};

export function parsePermissions(csv: string): Permission[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Permission => s in PERMISSIONS);
}

export function hasPermission(csv: string, p: Permission): boolean {
  return parsePermissions(csv).includes(p);
}
