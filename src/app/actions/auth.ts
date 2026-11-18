"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { attemptLogin, audit, createSession, destroySession, hashPassword, requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export type FormState = { error?: string; fieldErrors?: Record<string, string[]>; success?: string } | undefined;

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Required"),
    lastName: z.string().trim().min(1, "Required"),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    phone: z.string().trim().optional(),
    accountType: z.enum(["guest", "institution"]),
    institution: z.string().trim().optional(),
    department: z.string().trim().optional(),
    staffRole: z.string().trim().optional(),
    password: z
      .string()
      .min(10, "At least 10 characters")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" })
  .refine((d) => d.accountType !== "institution" || !!d.institution, {
    path: ["institution"],
    message: "Institution name is required",
  })
  .refine((d) => d.accountType !== "institution" || !!d.department, {
    path: ["department"],
    message: "Department or faculty is required",
  })
  .refine((d) => d.accountType !== "institution" || !!d.staffRole, {
    path: ["staffRole"],
    message: "Staff number or coordinator role is required",
  });

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  if (await db.user.findUnique({ where: { email: d.email } })) {
    return { fieldErrors: { email: ["An account with this email already exists"] } };
  }

  const role = await db.role.findUnique({
    where: { name: d.accountType === "institution" ? "Institutional Coordinator" : "Public Guest" },
  });
  if (!role) return { error: "System is not initialised. Run the database seed." };

  const verifyToken = crypto.randomBytes(24).toString("hex");
  const formattedInstitution =
    d.accountType === "institution"
      ? [d.institution, d.department, d.staffRole].filter(Boolean).join(" · ")
      : null;

  const user = await db.user.create({
    data: {
      email: d.email,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone || null,
      institution: formattedInstitution,
      passwordHash: await hashPassword(d.password),
      roleId: role.id,
      emailVerifyToken: verifyToken,
    },
  });
  await audit({ actorId: user.id, action: "user.register", entity: "User", entityId: user.id });

  // FR-002: email verification. Email integration is pending DUT ICT approval,
  // so the link is queued as a notification (and logged in development).
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/verify?token=${verifyToken}`;
  await db.notification.create({
    data: {
      toEmail: user.email,
      subject: "Verify your DUT-AMP account",
      body: `Welcome to DUT-AMP. Verify your email: ${link}`,
    },
  });
  if (process.env.NODE_ENV !== "production") console.log(`[dev] verification link for ${user.email}: ${link}`);

  await createSession(user.id);
  redirect("/account");
}

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password." };

  const result = await attemptLogin(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };

  await createSession(result.userId);
  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }
  const loggedInUser = await db.user.findUnique({
    where: { id: result.userId },
    include: { role: true },
  });
  const isStaff = loggedInUser ? hasPermission(loggedInUser.role.permissions, "dashboard.view") : false;
  redirect(isStaff ? "/admin" : "/account");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

/** FR-107: Guests update their personal information. */
export async function updateProfile(formData: FormData) {
  const sessionUser = await requireUser();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  if (!firstName || !lastName) {
    redirect(`/account?error=${encodeURIComponent("First and last name are required.")}`);
  }

  const before = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const after = await db.user.update({
    where: { id: sessionUser.id },
    data: { firstName, lastName, phone, institution },
  });

  await audit({
    actorId: sessionUser.id,
    action: "user.profile_update",
    entity: "User",
    entityId: sessionUser.id,
    before: { firstName: before.firstName, lastName: before.lastName, phone: before.phone },
    after: { firstName: after.firstName, lastName: after.lastName, phone: after.phone },
  });
  revalidatePath("/account");
  redirect("/account?saved=1");
}

/** FR-004, FR-005: Generate 6-digit OTP for password recovery / sensitive account activity. */
export async function requestOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const otp = String(crypto.randomInt(100000, 999999));
    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: otp,
        resetTokenExpiry: new Date(Date.now() + 15 * 60_000),
      },
    });
    await db.notification.create({
      data: {
        toEmail: user.email,
        subject: "Your DUT-AMP Security OTP",
        body: `Your 6-digit security OTP is: ${otp} (valid for 15 minutes).`,
      },
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev] OTP for ${user.email}: ${otp}`);
    }
  }
  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}

/** FR-004, FR-005, FR-157: Verify OTP and update password. */
export async function resetPasswordWithOtp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const otp = String(formData.get("otp") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");

  if (newPassword.length < 10) {
    redirect(`/forgot-password?error=Password+must+be+at+least+10+characters&email=${encodeURIComponent(email)}`);
  }

  const user = await db.user.findUnique({ where: { email } });
  if (
    !user ||
    !user.resetToken ||
    user.resetToken !== otp ||
    !user.resetTokenExpiry ||
    user.resetTokenExpiry < new Date()
  ) {
    redirect(`/forgot-password?error=Invalid+or+expired+OTP&email=${encodeURIComponent(email)}`);
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      resetToken: null,
      resetTokenExpiry: null,
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  await audit({
    actorId: user.id,
    action: "user.password_change",
    entity: "User",
    entityId: user.id,
  });

  redirect("/login");
}

