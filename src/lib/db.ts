import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { PrismaClient } from "@prisma/client";
import { SEED_DB_GZIP_BASE64 } from "./seed-snapshot";

function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();

  // If a remote database URL (PostgreSQL, MySQL, LibSQL, etc.) is configured, use it directly
  if (configured && !configured.startsWith("file:")) {
    return configured;
  }

  const repoDbPath = path.join(process.cwd(), "prisma", "dev.db");
  const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.NETLIFY);

  // Check if the local prisma directory is writable when not on serverless
  let canWriteLocal = !isServerless;
  if (canWriteLocal) {
    try {
      const dir = path.dirname(repoDbPath);
      fs.accessSync(dir, fs.constants.W_OK);
      if (!fs.existsSync(repoDbPath) || fs.statSync(repoDbPath).size === 0) {
        const raw = zlib.gunzipSync(Buffer.from(SEED_DB_GZIP_BASE64, "base64"));
        fs.writeFileSync(repoDbPath, raw);
      }
    } catch {
      canWriteLocal = false;
    }
  }

  if (canWriteLocal && fs.existsSync(repoDbPath)) {
    return `file:${repoDbPath}`;
  }

  // Serverless / read-only filesystem fallback (e.g. Vercel /tmp/dut-amp-dev.db)
  const tmpDbPath = path.join(os.tmpdir(), "dut-amp-dev.db");
  try {
    if (!fs.existsSync(tmpDbPath) || fs.statSync(tmpDbPath).size === 0) {
      const raw =
        fs.existsSync(repoDbPath) && fs.statSync(repoDbPath).size > 0
          ? fs.readFileSync(repoDbPath)
          : zlib.gunzipSync(Buffer.from(SEED_DB_GZIP_BASE64, "base64"));
      fs.writeFileSync(tmpDbPath, raw, { mode: 0o666 });
    }
    fs.chmodSync(tmpDbPath, 0o666);
  } catch (err) {
    console.error("[db] Failed to initialise writable SQLite database in tmpdir:", err);
  }

  return `file:${tmpDbPath}`;
}

const resolvedUrl = resolveDatabaseUrl();
process.env.DATABASE_URL = resolvedUrl;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: resolvedUrl },
    },
  });

globalForPrisma.prisma = db;
