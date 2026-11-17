import crypto from "node:crypto";

export type GatewayProvider = "PAYFAST" | "OZOW" | "PEACH";

export function getPayFastConfig() {
  const mode = process.env.PAYFAST_MODE ?? "sandbox";
  const actionUrl =
    mode === "live"
      ? "https://www.payfast.co.za/eng/process"
      : "https://sandbox.payfast.co.za/eng/process";

  return {
    mode,
    actionUrl,
    // Official PayFast Sandbox test credentials as fallback when env vars are not yet set by DUT Finance
    merchantId: process.env.PAYFAST_MERCHANT_ID || "10000100",
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || "46f0cd694581a",
    passphrase: process.env.PAYFAST_PASSPHRASE || "",
    appUrl: process.env.APP_URL || "http://localhost:3000",
  };
}

/** Generate PayFast MD5 signature over ordered key/value pairs. */
export function signPayFastPayload(fields: Record<string, string>, passphrase = ""): string {
  const pairs: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== "") {
      pairs.push(`${k}=${encodeURIComponent(v.trim()).replace(/%20/g, "+")}`);
    }
  }
  if (passphrase) {
    pairs.push(`passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`);
  }
  return crypto.createHash("md5").update(pairs.join("&")).digest("hex");
}

export function buildPayFastCheckoutFields(args: {
  paymentId: string;
  bookingId: string;
  bookingReference: string;
  residenceName: string;
  amount: number;
  firstName: string;
  lastName: string;
  email: string;
}) {
  const cfg = getPayFastConfig();
  const baseFields = {
    merchant_id: cfg.merchantId,
    merchant_key: cfg.merchantKey,
    return_url: `${cfg.appUrl}/account/bookings/${args.bookingId}?paid=1`,
    cancel_url: `${cfg.appUrl}/account/bookings/${args.bookingId}?cancelled=1`,
    notify_url: `${cfg.appUrl}/api/payments/payfast-itn`,
    name_first: args.firstName,
    name_last: args.lastName,
    email_address: args.email,
    m_payment_id: args.paymentId,
    amount: args.amount.toFixed(2),
    item_name: `DUT Accommodation ${args.bookingReference} (${args.residenceName})`,
  };
  const signature = signPayFastPayload(baseFields, cfg.passphrase);
  return {
    actionUrl: cfg.actionUrl,
    mode: cfg.mode,
    fields: { ...baseFields, signature },
  };
}
