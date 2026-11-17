import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROOM_OP_STATUSES, ROOM_TYPES, ROOM_TYPE_LABEL } from "@/lib/constants";
import {
  createResidence,
  createRoom,
  setRoomRestriction,
  setRoomStatus,
  toggleBed,
  toggleResidence,
  toggleRoom,
  updateResidence,
} from "@/app/actions/admin";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Residences, Rooms & Beds · Admin · DUT-AMP" };

const input = "mt-1 w-full rounded-xl border border-neutral-300 px-3 py-1.5 text-sm";

export default async function AdminResidences() {
  const user = await requirePermission("residences.manage");
  const canOps = hasPermission(user.permissions, "operations.manage");
  const residences = await db.residence.findMany({
    where: user.scopedResidenceId ? { id: user.scopedResidenceId } : {},
    orderBy: { name: "asc" },
    include: {
      rooms: {
        orderBy: { roomNumber: "asc" },
        include: { beds: { orderBy: { label: "asc" } } },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#112a22]">Residences, Rooms &amp; Individual Bed Inventory</h1>
          <p className="text-xs text-neutral-500">
            Configure residence details, photographs, room operational readiness, and individual bed activation.
          </p>
        </div>
      </div>

      {!user.scopedResidenceId && (
        <details className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <summary className="cursor-pointer font-bold text-[#112a22]">+ Register New Residence Facility</summary>
          <form action={createResidence} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold" htmlFor="r-name">Residence Name</label>
              <input id="r-name" name="name" required className={input} />
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor="r-campus">Campus</label>
              <input id="r-campus" name="campus" placeholder="e.g. Ritson / Steve Biko" className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold" htmlFor="r-desc">Description</label>
              <textarea id="r-desc" name="description" required rows={2} className={input} />
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor="r-addr">Address / Location</label>
              <input id="r-addr" name="address" className={input} />
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor="r-fac">Facilities (comma-separated)</label>
              <input id="r-fac" name="facilities" placeholder="Wi-Fi,Shared kitchen,Laundry,24h security" className={input} />
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-full bg-[#112a22] px-5 py-2 text-xs font-bold text-[#c8f560]">
                Save Residence
              </button>
            </div>
          </form>
        </details>
      )}

      {residences.map((res) => (
        <section
          key={res.id}
          aria-labelledby={`h-${res.id}`}
          className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-4">
            <div>
              <h2 id={`h-${res.id}`} className="text-xl font-bold text-[#112a22] flex items-center gap-2">
                <span>{res.name}</span>
                {res.campus && (
                  <span className="rounded-full bg-[#e6ece8] px-3 py-0.5 text-xs font-bold text-[#112a22]">
                    {res.campus} Campus
                  </span>
                )}
                {!res.isActive && (
                  <span className="rounded-full bg-red-100 px-3 py-0.5 text-xs font-semibold text-red-800">
                    Inactive
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">{res.address} · {res.description}</p>
            </div>
            <form action={toggleResidence}>
              <input type="hidden" name="id" value={res.id} />
              <button className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-semibold hover:bg-neutral-50">
                {res.isActive ? "Deactivate Residence" : "Activate Residence"}
              </button>
            </form>
          </div>

          {/* Edit Residence Details & Photo URL */}
          <details className="rounded-2xl border border-neutral-200 bg-[#f6f7f3] p-4">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[#112a22]">
              ✎ Edit Residence Details, Facilities &amp; Photograph URL
            </summary>
            <form action={updateResidence} className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              <input type="hidden" name="id" value={res.id} />
              <div>
                <label className="text-xs font-semibold" htmlFor={`ed-name-${res.id}`}>Residence Name</label>
                <input id={`ed-name-${res.id}`} name="name" defaultValue={res.name} required className={input} />
              </div>
              <div>
                <label className="text-xs font-semibold" htmlFor={`ed-camp-${res.id}`}>Campus</label>
                <input id={`ed-camp-${res.id}`} name="campus" defaultValue={res.campus ?? ""} className={input} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold" htmlFor={`ed-desc-${res.id}`}>Description</label>
                <textarea id={`ed-desc-${res.id}`} name="description" defaultValue={res.description} rows={2} required className={input} />
              </div>
              <div>
                <label className="text-xs font-semibold" htmlFor={`ed-addr-${res.id}`}>Address / Location</label>
                <input id={`ed-addr-${res.id}`} name="address" defaultValue={res.address ?? ""} className={input} />
              </div>
              <div>
                <label className="text-xs font-semibold" htmlFor={`ed-fac-${res.id}`}>Facilities (comma-separated)</label>
                <input id={`ed-fac-${res.id}`} name="facilities" defaultValue={res.facilities} className={input} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold" htmlFor={`ed-pho-${res.id}`}>
                  Photograph URL (https://…)
                </label>
                <input
                  id={`ed-pho-${res.id}`}
                  name="photos"
                  defaultValue={res.photos}
                  placeholder="https://images.unsplash.com/photo-..."
                  className={input}
                />
              </div>
              <div className="sm:col-span-2">
                <button className="rounded-full bg-[#112a22] px-5 py-2 text-xs font-bold text-[#c8f560]">
                  Update Residence Details
                </button>
              </div>
            </form>
          </details>

          {/* Rooms & Individual Bed Controls Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Rooms and beds in {res.name}</caption>
              <thead className="bg-[#f6f7f3]">
                <tr>
                  <th scope="col" className="p-2.5">Room</th>
                  <th scope="col" className="p-2.5">Type</th>
                  <th scope="col" className="p-2.5">Individual Beds (Click to Activate / Deactivate)</th>
                  <th scope="col" className="p-2.5">Room Active</th>
                  <th scope="col" className="p-2.5">Operational Status</th>
                  <th scope="col" className="p-2.5">Temp Restriction</th>
                </tr>
              </thead>
              <tbody>
                {res.rooms.map((room) => (
                  <tr key={room.id} className="border-t border-neutral-100 align-middle">
                    <td className="p-2.5 font-bold text-[#112a22]">
                      {room.roomNumber}
                      {room.isAccessible && <span title="Wheelchair accessible"> ♿</span>}
                    </td>
                    <td className="p-2.5 text-xs">
                      {ROOM_TYPE_LABEL[room.type as keyof typeof ROOM_TYPE_LABEL] ?? room.type}
                    </td>
                    <td className="p-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {room.beds.map((bed) => (
                          <form key={bed.id} action={toggleBed}>
                            <input type="hidden" name="id" value={bed.id} />
                            <button
                              title={bed.isActive ? `Bed ${bed.label} is active (click to deactivate)` : `Bed ${bed.label} is inactive (click to activate)`}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                                bed.isActive
                                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200"
                                  : "bg-neutral-200 text-neutral-500 line-through hover:bg-neutral-300"
                              }`}
                            >
                              Bed {bed.label} {bed.isActive ? "✓" : "✕"}
                            </button>
                          </form>
                        ))}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <form action={toggleRoom}>
                        <input type="hidden" name="id" value={room.id} />
                        <button className="rounded-full border border-neutral-300 px-3 py-0.5 text-xs font-medium">
                          {room.isActive ? "Active" : "Inactive"}
                        </button>
                      </form>
                    </td>
                    <td className="p-2.5">
                      {canOps ? (
                        <form action={setRoomStatus} className="flex gap-1">
                          <input type="hidden" name="id" value={room.id} />
                          <label className="sr-only" htmlFor={`s-${room.id}`}>
                            Status for room {room.roomNumber}
                          </label>
                          <select
                            id={`s-${room.id}`}
                            name="status"
                            defaultValue={room.opStatus}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                          >
                            {ROOM_OP_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-lg bg-[#112a22] px-2.5 py-1 text-xs font-semibold text-white">
                            Set
                          </button>
                        </form>
                      ) : (
                        room.opStatus.replace(/_/g, " ")
                      )}
                    </td>
                    <td className="p-2.5">
                      <form action={setRoomRestriction} className="flex flex-wrap gap-1 text-xs">
                        <input type="hidden" name="id" value={room.id} />
                        <input
                          name="restrictedUntil"
                          type="date"
                          defaultValue={room.restrictedUntil ? room.restrictedUntil.toISOString().slice(0, 10) : ""}
                          className="rounded-lg border px-2 py-1 text-xs"
                        />
                        <input
                          name="restrictionNote"
                          defaultValue={room.restrictionNote ?? ""}
                          placeholder="Reason"
                          className="w-24 rounded-lg border px-2 py-1 text-xs"
                        />
                        <button className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium">
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Room Form */}
          <form action={createRoom} className="grid gap-3 rounded-2xl bg-[#f6f7f3] p-4 sm:grid-cols-6">
            <input type="hidden" name="residenceId" value={res.id} />
            <div>
              <label className="text-xs font-semibold" htmlFor={`n-${res.id}`}>New Room No.</label>
              <input id={`n-${res.id}`} name="roomNumber" required placeholder="e.g. 401" className={input} />
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor={`f-${res.id}`}>Floor</label>
              <input id={`f-${res.id}`} name="floor" placeholder="e.g. 4" className={input} />
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor={`t-${res.id}`}>Room Type</label>
              <select id={`t-${res.id}`} name="type" className={input}>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold" htmlFor={`c-${res.id}`}>Bed Count</label>
              <input id={`c-${res.id}`} name="capacity" type="number" min={1} defaultValue={1} className={input} />
            </div>
            <label className="flex items-center gap-1.5 self-end pb-2 text-xs font-semibold">
              <input type="checkbox" name="isAccessible" /> Accessible ♿
            </label>
            <button className="self-end rounded-full bg-[#112a22] px-4 py-2 text-xs font-bold text-[#c8f560]">
              + Add Room
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
