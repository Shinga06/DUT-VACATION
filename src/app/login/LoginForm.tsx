"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type FormState } from "@/app/actions/auth";

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      {state?.error && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" />
      </div>
      <button disabled={pending}
        className="w-full rounded-full bg-[#112a22] px-4 py-2.5 text-sm font-bold text-[#c8f560] hover:bg-[#1a3d32] disabled:opacity-60">
        {pending ? "Signing in…" : "Log in →"}
      </button>
      <p className="text-xs text-neutral-600 flex justify-between pt-1">
        <span>No account? <Link className="font-bold text-[#112a22] underline" href="/register">Register</Link></span>
        <Link className="font-bold text-[#112a22] underline" href="/forgot-password">Forgot password / OTP?</Link>
      </p>
    </form>
  );
}
