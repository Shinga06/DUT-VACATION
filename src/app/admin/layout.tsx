import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import AdminNav from "@/components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("dashboard.view");
  const scopedResidence = user.scopedResidenceId
    ? await db.residence.findUnique({ where: { id: user.scopedResidenceId } })
    : null;

  const navItems = [
    { href: "/admin", label: "Overview" },
    ...(hasPermission(user.permissions, "bookings.view")
      ? [{ href: "/admin/bookings", label: "Bookings & EFT" }]
      : []),
    ...(hasPermission(user.permissions, "residences.manage")
      ? [{ href: "/admin/residences", label: "Residences & Rooms" }]
      : []),
    ...(hasPermission(user.permissions, "pricing.manage")
      ? [{ href: "/admin/pricing", label: "Pricing & Policies" }]
      : []),
    ...(hasPermission(user.permissions, "operations.manage")
      ? [{ href: "/admin/operations", label: "Cleaning & Maintenance" }]
      : []),
    { href: "/admin/reports", label: "Reports & Feedback" },
    ...(hasPermission(user.permissions, "users.manage")
      ? [{ href: "/admin/users", label: "Users & Roles" }]
      : []),
    ...(hasPermission(user.permissions, "audit.view")
      ? [{ href: "/admin/audit", label: "Audit Log" }]
      : []),
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="rounded-[24px] sm:rounded-[28px] bg-[#112a22] p-5 sm:p-8 text-white shadow-md space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-[#c8f560] px-3.5 py-1 text-xs font-bold text-[#112a22]">
              Student Housing Command Studio
            </span>
            {scopedResidence && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-amber-300">
                Scoped: {scopedResidence.name}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-300">
            Signed in as <strong>{user.name}</strong> · {user.roleName}
          </p>
        </div>

        <AdminNav items={navItems} />
      </div>

      {children}
    </div>
  );
}
