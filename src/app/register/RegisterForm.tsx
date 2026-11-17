"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { register, type FormState } from "@/app/actions/auth";

function Field({
  label,
  name,
  type = "text",
  placeholder,
  errors,
  autoComplete,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  errors?: string[];
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={!!errors}
        aria-describedby={errors ? `${name}-err` : undefined}
        className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm text-[#112a22]"
      />
      {errors && (
        <p id={`${name}-err`} className="mt-1 text-xs font-medium text-red-700">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

export default function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(register, undefined);
  const [accountType, setAccountType] = useState<"guest" | "institution">("guest");
  const e = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      {/* Segmented Account Type Selector */}
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          Select Account Type
        </legend>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f2f4ef] p-1.5">
          <label
            className={`flex cursor-pointer items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold transition ${
              accountType === "guest"
                ? "bg-[#112a22] text-[#c8f560] shadow-xs"
                : "text-neutral-700 hover:bg-white/60"
            }`}
          >
            <input
              type="radio"
              name="accountType"
              value="guest"
              checked={accountType === "guest"}
              onChange={() => setAccountType("guest")}
              className="sr-only"
            />
            Public Holiday Guest
          </label>
          <label
            className={`flex cursor-pointer items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold transition ${
              accountType === "institution"
                ? "bg-[#112a22] text-[#c8f560] shadow-xs"
                : "text-neutral-700 hover:bg-white/60"
            }`}
          >
            <input
              type="radio"
              name="accountType"
              value="institution"
              checked={accountType === "institution"}
              onChange={() => setAccountType("institution")}
              className="sr-only"
            />
            Institutional Coordinator
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First Name" name="firstName" autoComplete="given-name" errors={e.firstName} />
        <Field label="Last Name" name="lastName" autoComplete="family-name" errors={e.lastName} />
      </div>

      <Field
        label={accountType === "institution" ? "Official Institutional Email" : "Email Address"}
        name="email"
        type="email"
        placeholder={accountType === "institution" ? "e.g. coordinator@university.ac.za" : "e.g. name@example.com"}
        autoComplete="email"
        errors={e.email}
      />

      <Field
        label={accountType === "institution" ? "Official Contact Number" : "Phone Number"}
        name="phone"
        type="tel"
        placeholder="e.g. 082 555 0192"
        autoComplete="tel"
        required={accountType === "institution"}
        errors={e.phone}
      />

      {/* Conditional Institutional Coordinator Details */}
      {accountType === "institution" && (
        <div className="rounded-2xl border border-neutral-200 bg-[#f6f7f3] p-4 space-y-3.5">
          <div className="border-b border-neutral-200/80 pb-2">
            <p className="text-xs font-bold text-[#112a22]">Visiting Institution &amp; Coordinator Details</p>
            <p className="text-[11px] text-neutral-500">
              Required for year-round delegation bookings, group discounts, and Student Housing verification.
            </p>
          </div>
          <Field
            label="Institution / University / Organisation Name"
            name="institution"
            placeholder="e.g. University of KwaZulu-Natal (UKZN)"
            errors={e.institution}
          />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field
              label="Department / Faculty / Division"
              name="department"
              placeholder="e.g. Sports Administration"
              errors={e.department}
            />
            <Field
              label="Staff Number / Coordinator Role"
              name="staffRole"
              placeholder="e.g. STF-402 · Head of Delegation"
              errors={e.staffRole}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" name="password" type="password" autoComplete="new-password" errors={e.password} />
        <Field label="Confirm Password" name="confirm" type="password" autoComplete="new-password" errors={e.confirm} />
      </div>

      <button
        disabled={pending}
        className="w-full rounded-full bg-[#112a22] px-4 py-2.5 text-sm font-bold text-[#c8f560] hover:bg-[#1a3d32] disabled:opacity-60"
      >
        {pending
          ? "Creating account…"
          : accountType === "institution"
            ? "Register as Institutional Coordinator →"
            : "Create Guest Account →"}
      </button>

      <p className="text-xs text-neutral-600">
        Already registered?{" "}
        <Link className="font-bold text-[#112a22] underline" href="/login">
          Log in
        </Link>
      </p>
    </form>
  );
}
