"use client";

import { useEffect, useState } from "react";

type Day = { date: string; freeBeds: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AvailabilityCalendar({ residenceId }: { residenceId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [type, setType] = useState("");
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/calendar?residenceId=${residenceId}&month=${month}&type=${type}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setDays(d.days))
      .catch(() => !cancelled && setDays([]));
    return () => {
      cancelled = true;
    };
  }, [residenceId, month, type]);

  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setDays(null);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-[24px] sm:rounded-[28px] border border-black/5 bg-white p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="h-9 w-9 rounded-full border border-neutral-300 bg-white font-bold text-[#112a22] hover:bg-neutral-100"
          >
            ‹
          </button>
          <h3 className="min-w-36 sm:min-w-44 text-center text-sm sm:text-base font-bold text-[#112a22]" aria-live="polite">
            {label}
          </h3>
          <button
            onClick={() => shift(1)}
            aria-label="Next month"
            className="h-9 w-9 rounded-full border border-neutral-300 bg-white font-bold text-[#112a22] hover:bg-neutral-100"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="cal-type" className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Room Type
          </label>
          <select
            id="cal-type"
            value={type}
            onChange={(e) => {
              setDays(null);
              setType(e.target.value);
            }}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-[#112a22]"
          >
            <option value="">All Room Types</option>
            <option value="SINGLE">Single</option>
            <option value="DOUBLE">Double</option>
            <option value="SHARING">Multiple sharing</option>
          </select>
        </div>
      </div>

      {!days ? (
        <p className="py-8 text-center text-sm text-neutral-500">Loading live bed inventory…</p>
      ) : (
        <div role="grid" aria-label={`Availability for ${label}`} className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-xs sm:text-sm">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
              {d}
            </div>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <div key={`b${i}`} role="gridcell" aria-hidden />
          ))}
          {days.map((d) => {
            const past = d.date < todayIso;
            const available = !past && d.freeBeds > 0;
            return (
              <div
                key={d.date}
                role="gridcell"
                aria-label={`${d.date}: ${past ? "past" : available ? `${d.freeBeds} beds available` : "unavailable"}`}
                className={`rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 transition ${
                  past
                    ? "bg-neutral-100 text-neutral-400"
                    : available
                      ? "bg-[#e6f4ea] text-[#112a22] border border-[#b7e1c4]"
                      : "bg-red-50 text-red-900 line-through border border-red-200"
                }`}
              >
                <div className="font-bold">{Number(d.date.slice(8))}</div>
                {!past && (
                  <div className="text-[10px] sm:text-[11px] font-medium leading-tight">
                    {available ? (
                      <>
                        <span className="sm:hidden">{d.freeBeds}b</span>
                        <span className="hidden sm:inline">{d.freeBeds} free</span>
                      </>
                    ) : (
                      "full"
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-neutral-500">
        <span className="mr-4 inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Available beds
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Fully booked / restricted
        </span>{" "}
        · Accessible text labels provided for screen readers (WCAG 2.2 AA).
      </p>
    </div>
  );
}
