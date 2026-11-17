import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { requestOtp, resetPasswordWithOtp } from "@/app/actions/auth";

export const metadata = { title: "Reset Password · DUT-AMP" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; email?: string; error?: string }>;
}) {
  const { sent, email, error } = await searchParams;
  const user = await getSessionUser();
  const showVerifyStep = Boolean(sent || error);

  return (
    <div className="mx-auto max-w-md py-6 space-y-4">
      {/* Clean Top Back Link */}
      <div>
        <Link
          href={user ? "/account" : "/login"}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 transition"
        >
          <span aria-hidden="true">←</span>
          <span>{user ? "Back to My Account" : "Back to Sign In"}</span>
        </Link>
      </div>

      {/* Main Security Card */}
      <div className="rounded-[28px] border border-black/5 bg-white p-8 shadow-[0_12px_40px_rgb(0,0,0,0.05)] space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#e6ece8] px-3 py-1 text-xs font-bold text-[#112a22]">
            <span>{showVerifyStep ? "Step 2 of 2 · Verification" : "Step 1 of 2 · Account Recovery"}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#112a22]">
            {showVerifyStep ? "Enter Verification Code" : "Reset Your Password"}
          </h1>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {showVerifyStep
              ? `We have sent a 6-digit verification code to ${email || "your registered email address"}. Enter the code below to set your new password.`
              : "Enter the email address associated with your account and we will send you a 6-digit verification code to reset your password."}
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-3.5 text-xs font-medium text-red-800">
            {error}
          </div>
        )}

        {!showVerifyStep ? (
          /* STEP 1: Request Verification Code */
          <form action={requestOtp} className="space-y-4">
            <div>
              <label
                htmlFor="otp-email"
                className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
              >
                Email Address
              </label>
              <input
                id="otp-email"
                name="email"
                type="email"
                defaultValue={email ?? user?.email ?? ""}
                placeholder="name@example.com"
                required
                className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm font-medium text-[#112a22]"
              />
            </div>

            <button className="w-full rounded-full bg-[#112a22] px-5 py-3 text-sm font-bold text-[#c8f560] shadow hover:bg-[#1a3d32] transition">
              Send Verification Code →
            </button>
          </form>
        ) : (
          /* STEP 2: Verify Code & Set New Password */
          <div className="space-y-5">
            <form action={resetPasswordWithOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="r-email"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
                >
                  Account Email
                </label>
                <input
                  id="r-email"
                  name="email"
                  type="email"
                  defaultValue={email ?? user?.email ?? ""}
                  required
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-700"
                />
              </div>

              <div>
                <label
                  htmlFor="r-otp"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
                >
                  6-Digit Verification Code
                </label>
                <input
                  id="r-otp"
                  name="otp"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="• • • • • •"
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-center font-mono text-lg font-bold tracking-[0.35em] text-[#112a22]"
                />
              </div>

              <div>
                <label
                  htmlFor="r-pw"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-500"
                >
                  New Password
                </label>
                <input
                  id="r-pw"
                  name="newPassword"
                  type="password"
                  minLength={10}
                  required
                  placeholder="At least 10 characters"
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <button className="w-full rounded-full bg-[#112a22] px-5 py-3 text-sm font-bold text-[#c8f560] shadow hover:bg-[#1a3d32] transition">
                Verify &amp; Update Password →
              </button>
            </form>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-4 text-xs text-neutral-500">
              <span>Didn&apos;t receive the code?</span>
              <form action={requestOtp}>
                <input type="hidden" name="email" value={email ?? user?.email ?? ""} />
                <button className="font-bold text-[#112a22] underline hover:text-neutral-700">
                  Resend verification code
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
