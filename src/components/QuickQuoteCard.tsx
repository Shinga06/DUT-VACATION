"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Rule = {
  id: string;
  name: string;
  roomType: string | null;
  season: string | null;
  pricePerBedPerNight: number;
  minNights: number | null;
  maxNights: number | null;
  minGroupSize: number | null;
  discountPercent: number;
  priority: number;
};

const zar = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(n);

export default function QuickQuoteCard({
  residenceSlug,
  rules,
}: {
  residenceSlug: string;
  rules: Rule[];
}) {
  const [checkIn, setCheckIn] = useState("2026-12-05");
  const [checkOut, setCheckOut] = useState("2026-12-10");
  const [roomType, setRoomType] = useState<"SINGLE" | "DOUBLE" | "SHARING">("SINGLE");
  const [occupants, setOccupants] = useState(1);

  const estimate = useMemo(() => {
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    if (isNaN(+d1) || isNaN(+d2)) return { error: "Select valid check-in and check-out dates." };
    const nights = Math.round((d2.setHours(0, 0, 0, 0) - d1.setHours(0, 0, 0, 0)) / 86_400_000);
    if (nights < 1) return { error: "Check-out date must be after check-in date." };

    const month = new Date(checkIn).getMonth();
    const season = month === 5 ? "JUNE" : month === 11 ? "DECEMBER" : null;

    const candidates = rules
      .filter((r) => !r.roomType || r.roomType === roomType)
      .filter((r) => !r.season || r.season === season)
      .filter((r) => (!r.minNights || nights >= r.minNights) && (!r.maxNights || nights <= r.maxNights));

    if (candidates.length === 0) {
      return { error: "No matching rate plan for this stay length or room type." };
    }

    const best = [...candidates].sort((a, b) => b.priority - a.priority)[0];
    const discount = best.minGroupSize && occupants >= best.minGroupSize ? best.discountPercent : 0;
    const subtotal = nights * occupants * best.pricePerBedPerNight;
    const total = Math.round(subtotal * (1 - discount / 100) * 100) / 100;

    return {
      nights,
      rate: best.pricePerBedPerNight,
      ruleName: best.name,
      discount,
      total,
    };
  }, [checkIn, checkOut, roomType, occupants, rules]);

  return (
    <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_12px_40px_rgb(0,0,0,0.05)] space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div>
          <span className="inline-block rounded-full bg-[#e6ece8] px-3 py-0.5 text-[11px] font-bold text-[#112a22]">
            Instant Cost Estimator
          </span>
          <h3 className="mt-1 text-lg font-bold text-[#112a22]">Quick Quote &amp; Reserve</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <label htmlFor="qq-in" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Check-in
          </label>
          <input
            id="qq-in"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
          />
        </div>
        <div>
          <label htmlFor="qq-out" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Check-out
          </label>
          <input
            id="qq-out"
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
          />
        </div>
        <div>
          <label htmlFor="qq-type" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Room Type
          </label>
          <select
            id="qq-type"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value as "SINGLE" | "DOUBLE" | "SHARING")}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
          >
            <option value="SINGLE">Single</option>
            <option value="DOUBLE">Double</option>
            <option value="SHARING">Multiple Sharing</option>
          </select>
        </div>
        <div>
          <label htmlFor="qq-occ" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Guests
          </label>
          <input
            id="qq-occ"
            type="number"
            min={1}
            value={occupants}
            onChange={(e) => setOccupants(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium"
          />
        </div>
      </div>

      {"error" in estimate ? (
        <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          {estimate.error}
        </p>
      ) : (
        <div className="rounded-2xl bg-[#112a22] p-4 text-white space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-300">
            <span>{estimate.ruleName}</span>
            <span>
              {estimate.nights} night(s) × {occupants} guest(s)
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xs text-neutral-200">Estimated Total</span>
            <span className="text-2xl font-extrabold text-[#c8f560]">{zar(estimate.total)}</span>
          </div>
          {estimate.discount > 0 && (
            <p className="text-[11px] text-[#c8f560]">
              ✦ Includes {estimate.discount}% group booking discount
            </p>
          )}
        </div>
      )}

      <Link
        href={`/book?residence=${residenceSlug}&type=${roomType}&checkIn=${checkIn}&checkOut=${checkOut}&occupants=${occupants}`}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#112a22] px-5 py-3 text-sm font-bold text-[#c8f560] shadow hover:bg-[#1a3d32] transition"
      >
        <span>Reserve This Stay</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
