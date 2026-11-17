import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createMaintenanceRequest,
  resolveMaintenanceRequest,
  updateCleaningTask,
} from "@/app/actions/admin";

export const metadata = { title: "Cleaning & Maintenance · Admin · DUT-AMP" };

export default async function AdminOperationsPage() {
  const user = await requirePermission("operations.manage");
  const roomScope = user.scopedResidenceId ? { residenceId: user.scopedResidenceId } : {};
  const [tasks, maintenance, rooms] = await Promise.all([
    db.cleaningTask.findMany({
      where: user.scopedResidenceId ? { room: { residenceId: user.scopedResidenceId } } : {},
      orderBy: { createdAt: "desc" },
      include: { room: { include: { residence: true } } },
    }),
    db.maintenanceRequest.findMany({
      where: user.scopedResidenceId ? { room: { residenceId: user.scopedResidenceId } } : {},
      orderBy: { createdAt: "desc" },
      include: { room: { include: { residence: true } } },
    }),
    db.room.findMany({
      where: { isActive: true, ...roomScope },
      orderBy: { roomNumber: "asc" },
      include: { residence: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Cleaning, Inspection &amp; Maintenance</h1>

      <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">Cleaning &amp; Room Inspections</h2>
        <p className="text-xs text-slate-600">
          Marking a cleaning task as <strong>INSPECTED</strong> automatically sets the room back to <strong>AVAILABLE</strong> for new bookings.
        </p>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-600">No cleaning tasks queued.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr><th className="p-2">Residence / Room</th><th className="p-2">Status</th><th className="p-2">Inspection outcome</th></tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-2">{t.room.residence.name} · Room {t.room.roomNumber}</td>
                  <td className="p-2">{t.status}</td>
                  <td className="p-2">
                    <form action={updateCleaningTask} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={t.id} />
                      <select name="status" defaultValue={t.status} className="rounded border px-2 py-1 text-xs">
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="DONE">DONE</option>
                        <option value="INSPECTED">INSPECTED (Mark Room Ready)</option>
                        <option value="FAILED">FAILED</option>
                      </select>
                      <input name="inspectionNote" defaultValue={t.inspectionNote ?? ""} placeholder="Inspection note" className="rounded border px-2 py-1 text-xs" />
                      <button className="rounded bg-blue-800 px-2.5 py-1 text-xs text-white">Update</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold">Maintenance Requests</h2>
        <form action={createMaintenanceRequest} className="grid gap-3 sm:grid-cols-5">
          <select name="roomId" required className="rounded border px-2 py-1.5 text-sm">
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.residence.name} – Room {r.roomNumber}</option>
            ))}
          </select>
          <input name="title" required placeholder="Issue description" className="rounded border px-2 py-1.5 text-sm sm:col-span-2" />
          <select name="priority" defaultValue="MEDIUM" className="rounded border px-2 py-1.5 text-sm">
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="URGENT">URGENT</option>
          </select>
          <button className="rounded bg-blue-800 px-3 py-1.5 text-sm text-white">Log maintenance</button>
        </form>

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100">
            <tr><th className="p-2">Room</th><th className="p-2">Issue</th><th className="p-2">Priority</th><th className="p-2">Status</th><th className="p-2">Action</th></tr>
          </thead>
          <tbody>
            {maintenance.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{m.room.residence.name} · {m.room.roomNumber}</td>
                <td className="p-2">{m.title}</td>
                <td className="p-2">{m.priority}</td>
                <td className="p-2">{m.status}</td>
                <td className="p-2">
                  {m.status !== "RESOLVED" && (
                    <form action={resolveMaintenanceRequest}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="rounded bg-green-700 px-2.5 py-1 text-xs text-white">Resolve &amp; Release Room</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {maintenance.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-slate-600">No maintenance requests.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
