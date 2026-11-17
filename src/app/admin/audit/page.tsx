import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Audit log · Admin · DUT-AMP" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("audit.view");
  const { q } = await searchParams;
  const [logs, logins] = await Promise.all([
    db.auditLog.findMany({
      where: q ? { OR: [{ action: { contains: q } }, { entity: { contains: q } }, { entityId: { contains: q } }] } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: true },
    }),
    db.loginAttempt.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Security &amp; Audit Log</h1>
        <a href="/api/export?kind=audit" className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">
          Export Audit Records CSV
        </a>
      </div>

      <form className="flex gap-2">
        <label htmlFor="q" className="sr-only">Search audit records</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search action, entity or ID"
          className="w-full max-w-sm rounded border border-slate-400 px-3 py-2" />
        <button className="rounded bg-blue-800 px-4 py-2 text-white">Search</button>
      </form>

      <section aria-labelledby="al">
        <h2 id="al" className="mb-2 text-lg font-semibold">Administrative activity</h2>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit records, newest first</caption>
            <thead className="bg-slate-100">
              <tr><th scope="col" className="p-2">When</th><th scope="col" className="p-2">Who</th><th scope="col" className="p-2">Action</th><th scope="col" className="p-2">Entity</th><th scope="col" className="p-2">Change</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{l.createdAt.toLocaleString("en-ZA")}</td>
                  <td className="p-2">{l.actor?.email ?? "system"}</td>
                  <td className="p-2">{l.action}</td>
                  <td className="p-2">{l.entity}</td>
                  <td className="max-w-md break-words p-2 font-mono text-xs">
                    {l.before && <div>before: {l.before.slice(0, 200)}</div>}
                    {l.after && <div>after: {l.after.slice(0, 200)}</div>}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td className="p-4 text-slate-600" colSpan={5}>No records.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ll">
        <h2 id="ll" className="mb-2 text-lg font-semibold">Recent login attempts</h2>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Recent login attempts</caption>
            <thead className="bg-slate-100">
              <tr><th scope="col" className="p-2">When</th><th scope="col" className="p-2">Email</th><th scope="col" className="p-2">Result</th><th scope="col" className="p-2">IP</th></tr>
            </thead>
            <tbody>
              {logins.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{a.createdAt.toLocaleString("en-ZA")}</td>
                  <td className="p-2">{a.email}</td>
                  <td className="p-2">{a.success ? "Success" : "Failed"}</td>
                  <td className="p-2">{a.ip ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
