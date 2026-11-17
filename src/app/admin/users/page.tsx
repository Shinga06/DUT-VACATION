import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/lib/permissions";
import {
  createCustomRole,
  createStaffUser,
  toggleUserActive,
  updateUserRoleAndScope,
} from "@/app/actions/admin";

export const metadata = { title: "Users & Roles · Admin · DUT-AMP" };

const input = "mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm";

export default async function AdminUsersPage() {
  await requirePermission("users.manage");
  const [users, roles, residences] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, include: { role: true } }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.residence.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#112a22]">Users, Staff Onboarding &amp; Role Permissions</h1>
          <p className="text-xs text-neutral-500">
            Create staff accounts directly, assign roles or residence scopes, deactivate accounts, and configure custom roles.
          </p>
        </div>
      </div>

      {/* Direct Staff / User Account Onboarding Form */}
      <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
        <div>
          <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-0.5 text-[11px] font-bold text-[#112a22]">
            Staff &amp; Officer Onboarding
          </span>
          <h2 className="mt-1 text-lg font-bold text-[#112a22]">+ Create Staff / User Account</h2>
          <p className="text-xs text-neutral-500">
            Directly onboard a Student Housing Administrator, Finance Officer, Accommodation Officer, or Coordinator with an initial password and optional residence scope.
          </p>
        </div>

        <form action={createStaffUser} className="grid gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label htmlFor="st-fn" className="block text-xs font-semibold">First Name</label>
            <input id="st-fn" name="firstName" required placeholder="e.g. Zanele" className={input} />
          </div>
          <div>
            <label htmlFor="st-ln" className="block text-xs font-semibold">Last Name</label>
            <input id="st-ln" name="lastName" required placeholder="e.g. Cele" className={input} />
          </div>
          <div>
            <label htmlFor="st-em" className="block text-xs font-semibold">Official Email</label>
            <input id="st-em" name="email" type="email" required placeholder="zanele@dut.ac.za" className={input} />
          </div>
          <div>
            <label htmlFor="st-ph" className="block text-xs font-semibold">Phone</label>
            <input id="st-ph" name="phone" type="tel" placeholder="031 373 2000" className={input} />
          </div>
          <div>
            <label htmlFor="st-rl" className="block text-xs font-semibold">Assigned Role</label>
            <select id="st-rl" name="roleId" required className={input}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="st-sc" className="block text-xs font-semibold">Residence Scope</label>
            <select id="st-sc" name="scopedResidenceId" className={input}>
              <option value="">All Residences</option>
              {residences.map((res) => (
                <option key={res.id} value={res.id}>{res.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="st-pw" className="block text-xs font-semibold">Initial Password (min 10 characters)</label>
            <input
              id="st-pw"
              name="password"
              type="password"
              minLength={10}
              defaultValue="ChangeMe!2026"
              required
              className={input}
            />
          </div>
          <div className="sm:col-span-1 lg:col-span-3 self-end">
            <button className="w-full rounded-full bg-[#112a22] px-5 py-2.5 text-xs font-bold text-[#c8f560] hover:bg-[#1a3d32] transition">
              + Create Verified Account →
            </button>
          </div>
        </form>
      </section>

      {/* Existing Users Table */}
      <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
        <h2 className="text-lg font-bold text-[#112a22]">Registered Accounts &amp; Residence Scope</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f7f3]">
              <tr>
                <th className="p-2.5">Name &amp; Email</th>
                <th className="p-2.5">Role &amp; Residence Scope</th>
                <th className="p-2.5">Last Login</th>
                <th className="p-2.5">Account Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-neutral-100">
                  <td className="p-2.5">
                    <div className="font-bold text-[#112a22]">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-neutral-500">
                      {u.email} {u.institution ? `· ${u.institution}` : ""}
                    </div>
                  </td>
                  <td className="p-2.5">
                    <form action={updateUserRoleAndScope} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="roleId" defaultValue={u.roleId} className="rounded-lg border px-2.5 py-1 text-xs font-medium">
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <select name="scopedResidenceId" defaultValue={u.scopedResidenceId ?? ""} className="rounded-lg border px-2.5 py-1 text-xs">
                        <option value="">All Residences</option>
                        {residences.map((res) => (
                          <option key={res.id} value={res.id}>Scoped: {res.name}</option>
                        ))}
                      </select>
                      <button className="rounded-full bg-[#112a22] px-3 py-1 text-xs font-bold text-[#c8f560]">
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="p-2.5 text-xs text-neutral-500">
                    {u.lastLoginAt ? u.lastLoginAt.toLocaleString("en-ZA") : "Never"}
                  </td>
                  <td className="p-2.5">
                    <form action={toggleUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          u.isActive
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-red-300 bg-red-50 text-red-800"
                        }`}
                      >
                        {u.isActive ? "Active – Deactivate" : "Deactivated – Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Custom Role Builder */}
      <section className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
        <h2 className="text-lg font-bold text-[#112a22]">Roles &amp; Custom Role Builder</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f7f3]">
              <tr><th className="p-2.5">Role</th><th className="p-2.5">Type</th><th className="p-2.5">Permissions</th></tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="p-2.5 font-bold text-[#112a22]">{r.name}</td>
                  <td className="p-2.5 text-xs">{r.isSystem ? "System" : "Custom"}</td>
                  <td className="p-2.5 text-xs font-mono text-neutral-600">{r.permissions || "(guest self-service)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="rounded-2xl border border-neutral-200 bg-[#f6f7f3] p-4">
          <summary className="cursor-pointer text-sm font-bold text-[#112a22]">+ Create Custom Role</summary>
          <form action={createCustomRole} className="mt-3 space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="cr-name" className="block text-xs font-semibold">Role Name</label>
                <input id="cr-name" name="name" required placeholder="e.g. Residence Warden" className={input} />
              </div>
              <div>
                <label htmlFor="cr-desc" className="block text-xs font-semibold">Description</label>
                <input id="cr-desc" name="description" className={input} />
              </div>
            </div>
            <fieldset>
              <legend className="text-xs font-semibold mb-1.5">Assign Permissions</legend>
              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                {ALL_PERMISSIONS.map((p) => (
                  <label key={p} className="flex items-center gap-2">
                    <input type="checkbox" name="permissions" value={p} />
                    <span><strong>{p}</strong> – {PERMISSIONS[p]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="rounded-full bg-[#112a22] px-5 py-2 text-xs font-bold text-[#c8f560]">
              Save Custom Role
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
