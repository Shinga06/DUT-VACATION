"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded bg-blue-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
    >
      Print / Save as PDF
    </button>
  );
}
