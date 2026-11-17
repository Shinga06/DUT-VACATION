import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

// Email verification link (FR-002).
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token || !z.string().min(10).safeParse(token).success) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const user = await db.user.findFirst({ where: { emailVerifyToken: token } });
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true, emailVerifyToken: null } });
  }
  return NextResponse.redirect(new URL(user ? "/account?verified=1" : "/login", req.url));
}
