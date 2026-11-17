import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  SESSION_COOKIE,
} from "@/lib/constants";
import { hasPermission, type Permission } from "@/lib/permissions";

const secret = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me");

const SESSION_HOURS = 8;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roleName: string;
  permissions: string;
  scopedResidenceId: string | null;
};

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await db.user.findUnique({
      where: { id: String(payload.uid) },
      include: { role: true },
    });
    if (!user || !user.isActive) return null; // FR-007: deactivated users lose access
    return {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      roleName: user.role.name,
      permissions: user.role.permissions,
      scopedResidenceId: user.scopedResidenceId,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(p: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, p)) redirect("/account?denied=1");
  return user;
}

async function clientInfo() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

export async function audit(args: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const { ip } = await clientInfo();
  await db.auditLog.create({
    data: {
      actorId: args.actorId ?? null,
      action: args.action,
      entity: args.entity,
      entityId: args.entityId ?? null,
      before: args.before === undefined ? null : JSON.stringify(args.before),
      after: args.after === undefined ? null : JSON.stringify(args.after),
      ip,
    },
  });
}

export type LoginResult = { ok: true; userId: string } | { ok: false; error: string };

/** FR-003, FR-006, FR-156: authenticate, track failures, lock out brute force. */
export async function attemptLogin(email: string, password: string): Promise<LoginResult> {
  const { ip, userAgent } = await clientInfo();
  const normalised = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email: normalised } });
  const generic = "Invalid email or password.";

  const record = (success: boolean) =>
    db.loginAttempt.create({
      data: { userId: user?.id ?? null, email: normalised, success, ip, userAgent },
    });

  if (!user) {
    // Burn comparable time so account existence is not revealed by timing.
    await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid.");
    await record(false);
    return { ok: false, error: generic };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await record(false);
    return { ok: false, error: "Too many failed attempts. Try again later." };
  }

  if (!user.isActive) {
    await record(false);
    return { ok: false, error: "This account has been deactivated." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil:
          failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    await record(false);
    return { ok: false, error: generic };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await record(true);
  return { ok: true, userId: user.id };
}
