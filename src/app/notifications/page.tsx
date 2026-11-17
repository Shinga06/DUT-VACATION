import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Notifications · DUT-AMP" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const isStaff = hasPermission(user.permissions, "dashboard.view");

  const notifications = await db.notification.findMany({
    where: isStaff ? {} : { toEmail: user.email },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[#112a22]">Notifications &amp; Communication Log</h1>
          <p className="text-sm text-slate-600">
            {isStaff
              ? "System-wide email & dashboard alerts, booking confirmations, and delivery statuses."
              : `Alerts and booking messages sent to ${user.email}.`}
          </p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-600">
          No notifications yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li key={n.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-[#0b2a5b]">
                    {n.channel}
                  </span>
                  <h2 className="font-semibold text-slate-900">{n.subject}</h2>
                </div>
                <div className="text-xs text-slate-500">
                  {n.toEmail && <span className="mr-2 font-mono">{n.toEmail}</span>}
                  <span>{n.createdAt.toLocaleString("en-ZA")}</span>
                  <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                    {n.status}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-700 break-words">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
