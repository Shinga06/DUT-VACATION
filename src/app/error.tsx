"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const rawMessage = error?.message ?? "";
  const isRedactedServerError =
    !rawMessage ||
    rawMessage.includes("Minified React error") ||
    rawMessage.includes("Server Components render") ||
    rawMessage.includes("digest");

  const displayMessage = isRedactedServerError
    ? "The request could not be completed due to a validation rule or temporary server state. Please verify your inputs and try again."
    : rawMessage;

  return (
    <div className="mx-auto my-8 max-w-xl rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_12px_40px_rgb(0,0,0,0.06)] text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-xl">
        !
      </div>
      <h1 className="text-xl font-bold text-[#112a22]">Action could not be completed</h1>
      <p className="text-sm text-neutral-600 leading-relaxed">{displayMessage}</p>
      {error?.digest && (
        <p className="text-[11px] font-mono text-neutral-400">Reference ID: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button
          onClick={() => reset()}
          className="rounded-full bg-[#112a22] px-5 py-2.5 text-xs font-bold text-[#c8f560] hover:bg-[#1a3d32] transition"
        >
          Try again
        </button>
        <Link
          href="/search"
          className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs font-semibold text-[#112a22] hover:bg-neutral-50 transition"
        >
          Back to Search
        </Link>
        <Link
          href="/"
          className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
