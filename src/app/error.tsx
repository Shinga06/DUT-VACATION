"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-lg text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-xl">
        !
      </div>
      <h1 className="text-xl font-bold text-slate-900">Action could not be completed</h1>
      <p className="text-sm text-slate-600">
        {error.message || "A business rule or validation check prevented this request."}
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-[#0b2a5b] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
        >
          Try again
        </button>
        <Link
          href="/search"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Search
        </Link>
      </div>
    </div>
  );
}
