import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";
import { hasPermission } from "@/lib/permissions";
import { updateProfile } from "@/app/actions/auth";

export const metadata = { title: "My Account · DUT-AMP" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; verified?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const { denied, verified, saved } = await searchParams;
  const [dbUser, bookings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id } }),
    db.booking.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        residence: true,
        allocations: { where: { isActive: true }, include: { room: true, bed: true } },
      },
    }),
  ]);
  const staff = hasPermission(user.permissions, "dashboard.view");

  const initials = `${dbUser.firstName.charAt(0)}${dbUser.lastName.charAt(0)}`.toUpperCase();
  const activeBookings = bookings.filter((b) => !["CANCELLED", "REJECTED"].includes(b.status));
  const totalAgreed = activeBookings.reduce((s, b) => s + b.agreedTotal, 0);
  const totalPaid = activeBookings.reduce((s, b) => s + b.amountPaid, 0);
  const totalBalance = Math.max(0, totalAgreed - totalPaid);

  return (
    <div className="space-y-8">
      {/* Top Account Banner */}
      <header className="rounded-[28px] bg-[#112a22] p-6 sm:p-8 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#c8f560] text-lg font-extrabold text-[#112a22] shadow-inner">
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {dbUser.firstName} {dbUser.lastName}
              </h1>
              <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-[#c8f560]">
                {user.roleName}
              </span>
              {dbUser.emailVerified && (
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200">
                  ✓ Verified Email
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-neutral-300 mt-0.5">
              {dbUser.email} {dbUser.phone ? `· ${dbUser.phone}` : ""}{" "}
              {dbUser.institution ? `· ${dbUser.institution}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {staff && (
            <Link
              className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/25 transition"
              href="/admin"
            >
              Open Admin Studio →
            </Link>
          )}
          <Link
            className="rounded-full bg-[#c8f560] px-5 py-2.5 text-xs font-bold text-[#112a22] shadow hover:bg-[#d5f880] transition"
            href="/search"
          >
            + Book New Stay
          </Link>
        </div>
      </header>

      {/* Alerts */}
      {denied && (
        <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          You do not have permission to access that administrative page.
        </div>
      )}
      {verified && (
        <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Your email address has been verified.
        </div>
      )}
      {saved && (
        <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Your personal profile details have been updated and recorded.
        </div>
      )}

      {/* Main Two-Column Account Layout */}
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* LEFT COLUMN: Personal Information & Security Card */}
        <aside className="lg:col-span-4 space-y-6">
          <section
            aria-labelledby="prof-heading"
            className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-5"
          >
            <div className="border-b border-neutral-100 pb-4">
              <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-0.5 text-[11px] font-bold text-[#112a22]">
                Profile &amp; Contact
              </span>
              <h2 id="prof-heading" className="mt-1.5 text-lg font-bold text-[#112a22]">
                Personal Information
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Keep your contact and institutional details up to date for check-in and confirmations.
              </p>
            </div>

            <form action={updateProfile} className="space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <label
                    htmlFor="pf-fn"
                    className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
                  >
                    First Name
                  </label>
                  <input
                    id="pf-fn"
                    name="firstName"
                    defaultValue={dbUser.firstName}
                    required
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-medium text-[#112a22]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pf-ln"
                    className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
                  >
                    Last Name
                  </label>
                  <input
                    id="pf-ln"
                    name="lastName"
                    defaultValue={dbUser.lastName}
                    required
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-medium text-[#112a22]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Registered Email
                </label>
                <input
                  type="email"
                  value={dbUser.email}
                  disabled
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3.5 py-2 text-sm text-neutral-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label
                  htmlFor="pf-ph"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
                >
                  Phone Number
                </label>
                <input
                  id="pf-ph"
                  name="phone"
                  type="tel"
                  defaultValue={dbUser.phone ?? ""}
                  placeholder="e.g. 082 555 0192"
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-medium text-[#112a22]"
                />
              </div>

              {user.roleName === "Institutional Coordinator" && (
                <div>
                  <label
                    htmlFor="pf-in"
                    className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
                  >
                    Institution · Department · Coordinator Role
                  </label>
                  <input
                    id="pf-in"
                    name="institution"
                    defaultValue={dbUser.institution ?? ""}
                    required
                    placeholder="e.g. UKZN · Sports Dept · STF-402"
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm font-medium text-[#112a22]"
                  />
                </div>
              )}

              <button className="w-full rounded-full bg-[#112a22] px-5 py-2.5 text-sm font-bold text-[#c8f560] shadow-xs hover:bg-[#1a3d32] transition">
                Save Profile Changes
              </button>
            </form>

            {/* Separated Security & OTP Section */}
            <div className="border-t border-neutral-100 pt-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Account Security
                </h3>
                <span className="rounded-full bg-[#f2f4ef] px-2.5 py-0.5 text-[10px] font-semibold text-[#112a22]">
                  OTP Protected
                </span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Sensitive account changes require a 6-digit One-Time Pin (OTP) verification.
              </p>
              <Link
                href={`/forgot-password?email=${encodeURIComponent(user.email)}`}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-[#f6f7f3] px-4 py-2.5 text-xs font-bold text-[#112a22] hover:bg-neutral-200/70 transition"
              >
                <span>Change Password with OTP Verification</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>
        </aside>

        {/* RIGHT COLUMN: Bookings & Financial Overview */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick Summary KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
              <p className="text-xs font-medium text-neutral-500">Total Bookings</p>
              <p className="mt-1 text-2xl font-extrabold text-[#112a22]">{bookings.length}</p>
            </div>
            <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
              <p className="text-xs font-medium text-neutral-500">Verified Paid</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">{zar(totalPaid)}</p>
            </div>
            <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
              <p className="text-xs font-medium text-neutral-500">Outstanding Balance</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-700">{zar(totalBalance)}</p>
            </div>
          </div>

          <section aria-labelledby="bk" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="bk" className="text-xl font-bold text-[#112a22]">
                My Accommodation Bookings
              </h2>
              <Link href="/notifications" className="text-xs font-bold text-[#112a22] underline">
                View Notification Inbox →
              </Link>
            </div>

            {bookings.length === 0 ? (
              <div className="rounded-[28px] border border-black/5 bg-white p-10 text-center space-y-3 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
                <p className="text-base font-semibold text-[#112a22]">You have no bookings yet</p>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Search live availability across Ritson, Steve Biko, and ML Sultan Guest House to estimate your stay
                  and submit your first booking.
                </p>
                <div className="pt-2">
                  <Link
                    className="inline-flex rounded-full bg-[#112a22] px-6 py-2.5 text-xs font-bold text-[#c8f560] hover:bg-[#1a3d32] transition"
                    href="/search"
                  >
                    Explore &amp; Book Accommodation →
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="space-y-4">
                {bookings.map((b) => {
                  const balance = Math.max(0, b.agreedTotal - b.amountPaid);
                  return (
                    <li
                      key={b.id}
                      className="rounded-[26px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-neutral-500">
                              {b.reference ?? "BOOKING"}
                            </span>
                            <span className="rounded-full bg-[#e6ece8] px-3 py-0.5 text-xs font-bold text-[#112a22]">
                              {b.status.replace(/_/g, " ")}
                            </span>
                            <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-900">
                              Payment: {b.paymentStatus.replace(/_/g, " ")}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-[#112a22]">
                            <Link className="hover:underline" href={`/account/bookings/${b.id}`}>
                              {b.residence.name}
                            </Link>
                          </h3>
                          <p className="text-xs text-neutral-600">
                            {b.checkIn.toLocaleDateString("en-ZA")} – {b.checkOut.toLocaleDateString("en-ZA")} ·{" "}
                            {b.occupants} occupant(s) · {b.roomType ?? "Any Room"} · {b.type}
                            {b.allocations.length > 0 && (
                              <span className="ml-2 font-semibold text-[#112a22]">
                                (Allocated:{" "}
                                {b.allocations
                                  .map((a) => `Room ${a.room.roomNumber}${a.bed ? ` Bed ${a.bed.label}` : ""}`)
                                  .join(", ")}
                                )
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-extrabold text-[#112a22]">{zar(b.agreedTotal)}</p>
                          <p className="text-xs text-neutral-500">
                            Paid: {zar(b.amountPaid)}{" "}
                            {balance > 0 && <span className="text-amber-800 font-semibold">· Due: {zar(balance)}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-4">
                        <Link
                          href={`/account/bookings/${b.id}/document`}
                          className="text-xs font-bold text-neutral-600 hover:text-[#112a22] underline"
                        >
                          Download Invoice / Confirmation PDF
                        </Link>
                        <Link
                          className="rounded-full bg-[#112a22] px-4 py-2 text-xs font-bold text-[#c8f560] hover:bg-[#1a3d32] transition"
                          href={`/account/bookings/${b.id}`}
                        >
                          Manage Booking &amp; Payments →
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
