import { db } from "@/lib/db";
import { nightsBetween } from "@/lib/availability";

export type Quote =
  | {
      ok: true;
      nights: number;
      occupants: number;
      pricePerBedPerNight: number;
      discountPercent: number;
      total: number;
      ruleId: string;
      ruleName: string;
    }
  | { ok: false; error: string };

/** Season a stay falls in, based on the month of check-in (June / December). */
export function seasonFor(date: Date): "JUNE" | "DECEMBER" | null {
  const m = date.getMonth();
  if (m === 5) return "JUNE";
  if (m === 11) return "DECEMBER";
  return null;
}

/**
 * Pick the most specific active rule and compute an estimate (FR-016 - FR-018,
 * FR-025, FR-131). The returned numbers are copied onto the booking when it is
 * created so later rate changes never alter it (FR-020, BR-010).
 */
export async function quoteStay(args: {
  residenceId: string;
  roomType?: string;
  checkIn: Date;
  checkOut: Date;
  occupants: number;
  season?: string | null;
  institution?: string | null;
  event?: string | null;
}): Promise<Quote> {
  const nights = nightsBetween(args.checkIn, args.checkOut);
  if (nights < 1) return { ok: false, error: "Check-out must be after check-in." };
  if (args.occupants < 1) return { ok: false, error: "At least one occupant is required." };

  const season = args.season ?? seasonFor(args.checkIn);
  const rules = await db.pricingRule.findMany({ where: { isActive: true } });

  const candidates = rules
    .filter((r) => !r.residenceId || r.residenceId === args.residenceId)
    .filter((r) => !r.roomType || r.roomType === args.roomType)
    .filter((r) => !r.season || r.season === season)
    .filter((r) => !r.institution || r.institution === args.institution)
    .filter((r) => !r.event || r.event === args.event)
    .filter((r) => !r.validFrom || r.validFrom <= args.checkIn)
    .filter((r) => !r.validTo || r.validTo >= args.checkOut);

  if (candidates.length === 0) return { ok: false, error: "No pricing is configured for this selection." };

  const withinStay = candidates.filter(
    (r) => (!r.minNights || nights >= r.minNights) && (!r.maxNights || nights <= r.maxNights),
  );
  if (withinStay.length === 0) {
    const mins = candidates.map((r) => r.minNights ?? 1);
    const maxs = candidates.map((r) => r.maxNights ?? Infinity);
    const min = Math.min(...mins);
    const max = Math.max(...maxs);
    return {
      ok: false,
      error:
        nights < min
          ? `Minimum stay is ${min} night${min === 1 ? "" : "s"}.`
          : `Maximum stay is ${max} nights.`,
    };
  }

  const specificity = (r: (typeof withinStay)[number]) =>
    r.priority * 100 +
    (r.residenceId ? 8 : 0) +
    (r.roomType ? 4 : 0) +
    (r.institution ? 4 : 0) +
    (r.event ? 4 : 0) +
    (r.season ? 2 : 0);
  const best = [...withinStay].sort((a, b) => specificity(b) - specificity(a))[0];

  const discount = best.minGroupSize && args.occupants >= best.minGroupSize ? best.discountPercent : 0;
  const gross = nights * args.occupants * best.pricePerBedPerNight;
  const total = Math.round(gross * (1 - discount / 100) * 100) / 100;

  return {
    ok: true,
    nights,
    occupants: args.occupants,
    pricePerBedPerNight: best.pricePerBedPerNight,
    discountPercent: discount,
    total,
    ruleId: best.id,
    ruleName: best.name,
  };
}

export const zar = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(n);
