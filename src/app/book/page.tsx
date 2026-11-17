import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { quoteStay, zar } from "@/lib/pricing";
import { ROOM_TYPE_LABEL, type RoomType } from "@/lib/constants";
import { createBooking } from "@/app/actions/bookings";

export const metadata = { title: "Complete Booking · DUT-AMP" };

type Params = {
  residence?: string;
  type?: string;
  checkIn?: string;
  checkOut?: string;
  occupants?: string;
};

export default async function BookPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const qs = new URLSearchParams(sp as Record<string, string>).toString();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/book?${qs}`)}`);

  if (!sp.residence || !sp.type || !sp.checkIn || !sp.checkOut) notFound();
  const residence = await db.residence.findUnique({ where: { slug: sp.residence } });
  if (!residence || !residence.isActive) notFound();

  const occupants = Math.max(1, Number(sp.occupants) || 1);
  const checkIn = new Date(sp.checkIn);
  const checkOut = new Date(sp.checkOut);
  const quote = await quoteStay({
    residenceId: residence.id,
    roomType: sp.type,
    checkIn,
    checkOut,
    occupants,
  });

  const isCoordinator = user.roleName === "Institutional Coordinator";

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_12px_40px_rgb(0,0,0,0.05)]">
      <div>
        <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-1 text-xs font-bold text-[#112a22]">
          Step 2 · Guest Registration &amp; Price Lock
        </span>
        <h1 className="mt-2 text-2xl font-bold text-[#112a22]">Complete Your Booking</h1>
      </div>

      <div className="rounded-2xl bg-[#112a22] p-5 text-white space-y-1.5">
        <p className="font-bold text-lg text-[#c8f560]">{residence.name}</p>
        <p className="text-sm text-neutral-200">
          {ROOM_TYPE_LABEL[sp.type as RoomType] ?? sp.type} · {sp.checkIn} to {sp.checkOut} · {occupants} occupant(s)
        </p>
        {quote.ok ? (
          <p className="pt-2 text-2xl font-extrabold text-white">
            Agreed Total: {zar(quote.total)}{" "}
            <span className="text-xs font-normal text-neutral-300">
              ({quote.nights} nights × {occupants} @ {zar(quote.pricePerBedPerNight)}/night
              {quote.discountPercent > 0 ? `, ${quote.discountPercent}% group discount` : ""})
            </span>
          </p>
        ) : (
          <p className="text-red-300 font-medium">{quote.error}</p>
        )}
      </div>

      {quote.ok && (
        <form action={createBooking} className="space-y-4">
          <input type="hidden" name="residenceSlug" value={residence.slug} />
          <input type="hidden" name="roomType" value={sp.type} />
          <input type="hidden" name="checkIn" value={sp.checkIn} />
          <input type="hidden" name="checkOut" value={sp.checkOut} />
          <input type="hidden" name="occupants" value={occupants} />

          {isCoordinator ? (
            <>
              <input type="hidden" name="bookingType" value="INSTITUTIONAL" />
              <div className="rounded-2xl border border-neutral-200 bg-[#f6f7f3] p-4 space-y-3">
                <p className="text-xs font-bold text-[#112a22]">Institutional Delegation Details</p>
                <div>
                  <label htmlFor="eventName" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Conference / Event / Delegation Name
                  </label>
                  <input
                    id="eventName"
                    name="eventName"
                    required
                    placeholder="e.g. Annual Higher Education Research Summit"
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          ) : (
            <input type="hidden" name="bookingType" value="PUBLIC" />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="idNumber" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                ID / Passport Number
              </label>
              <input id="idNumber" name="idNumber" required className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="emergencyName" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Emergency Contact Name
              </label>
              <input id="emergencyName" name="emergencyName" required className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="emergencyPhone" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Emergency Contact Phone
              </label>
              <input id="emergencyPhone" name="emergencyPhone" type="tel" required className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label htmlFor="specialPreference" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Accommodation Preferences / Accessibility Needs (Optional)
            </label>
            <textarea id="specialPreference" name="specialPreference" rows={2} className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
          </div>

          <label className="flex items-start gap-2.5 rounded-2xl bg-[#f6f7f3] p-3.5 text-xs text-neutral-700">
            <input type="checkbox" name="rulesAccepted" required className="mt-0.5" />
            <span>
              I confirm my registration details are accurate and I digitally acknowledge the DUT Student Housing
              residence rules and accommodation conditions.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              name="submitMode"
              value="DRAFT"
              className="rounded-full border border-neutral-300 bg-[#f6f7f3] px-5 py-3 text-xs font-bold text-[#112a22] hover:bg-neutral-200/70 transition"
            >
              Save as Draft (Finish Later)
            </button>
            <button
              type="submit"
              name="submitMode"
              value="SUBMIT"
              className="flex-1 rounded-full bg-[#112a22] px-5 py-3 text-sm font-bold text-[#c8f560] shadow hover:bg-[#1a3d32] transition"
            >
              {isCoordinator ? "Submit Delegation Request →" : "Submit Booking & Proceed to Payment →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
