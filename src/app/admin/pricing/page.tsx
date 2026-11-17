import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROOM_TYPES, ROOM_TYPE_LABEL, SEASONS } from "@/lib/constants";
import { zar } from "@/lib/pricing";
import {
  createBookingPeriod,
  createCancellationPolicy,
  createPricingRule,
  toggleBookingPeriod,
  toggleCancellationPolicy,
  togglePricingRule,
} from "@/app/actions/admin";

export const metadata = { title: "Pricing, Periods & Policies · Admin · DUT-AMP" };

const input = "mt-1 w-full rounded-xl border border-neutral-300 px-3 py-1.5 text-sm";

export default async function AdminPricingPage() {
  await requirePermission("pricing.manage");
  const [rules, periods, policies, residences] = await Promise.all([
    db.pricingRule.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }], include: { residence: true } }),
    db.bookingPeriod.findMany({ orderBy: { startDate: "asc" } }),
    db.cancellationPolicy.findMany({ orderBy: { daysBeforeStay: "desc" } }),
    db.residence.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[#112a22]">Pricing Rules, Seasonal Periods &amp; Cancellation Policies</h1>

      <section aria-labelledby="pr-sec" className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
        <h2 id="pr-sec" className="text-lg font-bold text-[#112a22]">Accommodation Pricing Rules</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f7f3]">
              <tr>
                <th className="p-2.5">Name</th>
                <th className="p-2.5">Residence</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Season</th>
                <th className="p-2.5">Rate / Bed / Night</th>
                <th className="p-2.5">Conditions</th>
                <th className="p-2.5">Priority</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100">
                  <td className="p-2.5 font-medium text-[#112a22]">{r.name}</td>
                  <td className="p-2.5">{r.residence?.name ?? "All"}</td>
                  <td className="p-2.5">{r.roomType ? ROOM_TYPE_LABEL[r.roomType as keyof typeof ROOM_TYPE_LABEL] : "All"}</td>
                  <td className="p-2.5">{r.season ?? "Any"}</td>
                  <td className="p-2.5 font-bold">{zar(r.pricePerBedPerNight)}</td>
                  <td className="p-2.5 text-xs text-neutral-600">
                    {r.minNights ? `Min ${r.minNights}n ` : ""}
                    {r.maxNights ? `Max ${r.maxNights}n ` : ""}
                    {r.minGroupSize ? `${r.discountPercent}% off (${r.minGroupSize}+ guests)` : ""}
                  </td>
                  <td className="p-2.5">{r.priority}</td>
                  <td className="p-2.5">
                    <form action={togglePricingRule}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold">
                        {r.isActive ? "Active – Deactivate" : "Inactive – Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="rounded-2xl border border-neutral-200 bg-[#f6f7f3] p-4">
          <summary className="cursor-pointer text-sm font-bold text-[#112a22]">+ Add Pricing Rule</summary>
          <form action={createPricingRule} className="mt-3 grid gap-3 sm:grid-cols-4">
            <div><label className="text-xs font-semibold" htmlFor="p-name">Rule Name</label><input id="p-name" name="name" required className={input} /></div>
            <div>
              <label className="text-xs font-semibold" htmlFor="p-res">Residence</label>
              <select id="p-res" name="residenceId" className={input}>
                <option value="">All Residences</option>
                {residences.map((res) => <option key={res.id} value={res.id}>{res.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor="p-type">Room Type</label>
              <select id="p-type" name="roomType" className={input}>
                <option value="">All Types</option>
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor="p-sea">Season</label>
              <select id="p-sea" name="season" className={input}>
                <option value="">Any Season</option>
                {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="text-xs font-semibold" htmlFor="p-rate">Rate (ZAR / Bed / Night)</label><input id="p-rate" name="pricePerBedPerNight" type="number" step="0.01" min={1} required className={input} /></div>
            <div><label className="text-xs font-semibold" htmlFor="p-min">Min Nights</label><input id="p-min" name="minNights" type="number" min={1} className={input} /></div>
            <div><label className="text-xs font-semibold" htmlFor="p-max">Max Nights</label><input id="p-max" name="maxNights" type="number" min={1} className={input} /></div>
            <div><label className="text-xs font-semibold" htmlFor="p-grp">Min Group Size</label><input id="p-grp" name="minGroupSize" type="number" min={2} className={input} /></div>
            <div><label className="text-xs font-semibold" htmlFor="p-disc">Group Discount %</label><input id="p-disc" name="discountPercent" type="number" min={0} max={100} defaultValue={0} className={input} /></div>
            <div><label className="text-xs font-semibold" htmlFor="p-prio">Priority</label><input id="p-prio" name="priority" type="number" defaultValue={0} className={input} /></div>
            <div className="sm:col-span-2 self-end">
              <button className="rounded-full bg-[#112a22] px-5 py-2 text-xs font-bold text-[#c8f560]">Save Pricing Rule</button>
            </div>
          </form>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="bp-sec" className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
          <h2 id="bp-sec" className="text-lg font-bold text-[#112a22]">Approved Public Booking Periods</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f6f7f3]">
                <tr><th className="p-2">Period</th><th className="p-2">Season</th><th className="p-2">Dates</th><th className="p-2">Status</th></tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2">{p.season}</td>
                    <td className="p-2 text-xs">
                      {p.startDate.toLocaleDateString("en-ZA")} – {p.endDate.toLocaleDateString("en-ZA")}
                    </td>
                    <td className="p-2">
                      <form action={toggleBookingPeriod}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs">
                          {p.isActive ? "Active" : "Inactive"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={createBookingPeriod} className="grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs font-semibold" htmlFor="bp-name">Period Name</label><input id="bp-name" name="name" required placeholder="e.g. June 2027 Holiday" className={input} /></div>
            <div>
              <label className="text-xs font-semibold" htmlFor="bp-sea">Season</label>
              <select id="bp-sea" name="season" className={input}>
                <option value="JUNE">JUNE</option>
                <option value="DECEMBER">DECEMBER</option>
              </select>
            </div>
            <div><label className="text-xs font-semibold" htmlFor="bp-start">Start Date</label><input id="bp-start" name="startDate" type="date" required className={input} /></div>
            <div><label className="text-xs font-semibold" htmlFor="bp-end">End Date</label><input id="bp-end" name="endDate" type="date" required className={input} /></div>
            <div className="sm:col-span-2">
              <button className="rounded-full bg-[#112a22] px-4 py-2 text-xs font-bold text-[#c8f560]">+ Add Booking Period</button>
            </div>
          </form>
        </section>

        <section aria-labelledby="cp-sec" className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
          <h2 id="cp-sec" className="text-lg font-bold text-[#112a22]">Cancellation &amp; Refund Policy Tiers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f6f7f3]">
                <tr><th className="p-2">Policy Tier</th><th className="p-2">Days Before Stay</th><th className="p-2">Refund %</th><th className="p-2">Status</th></tr>
              </thead>
              <tbody>
                {policies.map((cp) => (
                  <tr key={cp.id} className="border-t border-neutral-100">
                    <td className="p-2 font-medium">{cp.name}</td>
                    <td className="p-2">{cp.daysBeforeStay}+ days</td>
                    <td className="p-2 font-bold text-emerald-700">{cp.refundPercent}%</td>
                    <td className="p-2">
                      <form action={toggleCancellationPolicy}>
                        <input type="hidden" name="id" value={cp.id} />
                        <button className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs">
                          {cp.isActive ? "Active" : "Inactive"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={createCancellationPolicy} className="grid gap-3 sm:grid-cols-3">
            <div><label className="text-xs font-semibold" htmlFor="cp-name">Tier Name</label><input id="cp-name" name="name" required placeholder="e.g. 30+ Days Full Refund" className={input} /></div>
            <div><label className="text-xs font-semibold" htmlFor="cp-days">Min Days Before</label><input id="cp-days" name="daysBeforeStay" type="number" min={0} required className={input} /></div>
            <div><label className="text-xs font-semibold" htmlFor="cp-pct">Refund %</label><input id="cp-pct" name="refundPercent" type="number" min={0} max={100} required className={input} /></div>
            <div className="sm:col-span-3">
              <button className="rounded-full bg-[#112a22] px-4 py-2 text-xs font-bold text-[#c8f560]">+ Add Refund Tier</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
