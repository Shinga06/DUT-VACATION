import { NextResponse } from "next/server";
import { getCalendar } from "@/lib/availability";

// Public: free beds per night for a residence (FR-128, FR-130).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const residenceId = url.searchParams.get("residenceId");
  const month = url.searchParams.get("month"); // YYYY-MM
  const type = url.searchParams.get("type") ?? undefined;
  if (!residenceId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "residenceId and month (YYYY-MM) are required" }, { status: 400 });
  }
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  const days = await getCalendar(residenceId, type || undefined, from, to);
  return NextResponse.json({ days });
}
