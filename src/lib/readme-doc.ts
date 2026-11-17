import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { zar } from "@/lib/pricing";
import { hasPermission } from "@/lib/permissions";

export const README_CONTENT = `# DUT Accommodation Management Platform (DUT-AMP)

**Software Requirements Specification (SRS v1.0) Full-Stack Implementation**  
**Proposed System Owner:** Durban University of Technology (DUT) Student Housing Department  
**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma ORM · SQLite (Dev) / PostgreSQL (Prod)

---

## 1. Quick Start & Running Locally

\`\`\`powershell
cd C:\\Users\\cashxchange\\.gemini\\antigravity\\scratch\\dut-amp-web

# Start the development server
npm.cmd run dev
\`\`\`

Open **http://localhost:3000** in your browser.

### Demo Accounts (Password for all accounts: \`ChangeMe!2026\`)

| Role | Email | Key Capabilities |
| :--- | :--- | :--- |
| **Super Administrator** | \`admin@dut-amp.local\` | Full platform control, custom role builder, user activation/deactivation, residence scoping, audit log |
| **Student Housing Administrator** | \`housing@dut-amp.local\` | Residences, rooms & beds, pricing rules, seasonal periods, booking approvals, feedback review, reports |
| **Finance Officer** | \`finance@dut-amp.local\` | EFT payment verification, receipt issuance, financial & revenue reports |
| **Accommodation Officer** | \`officer@dut-amp.local\` | Manual & automated room/bed allocations, preference status review, check-in/out, cleaning & maintenance |
| **Institutional Coordinator** | \`coordinator@ukzn.ac.za\` | Year-round delegation requests, bulk CSV delegate roster upload, individual delegate confirmations |
| **Public Guest** | \`guest@dut-amp.local\` | Holiday accommodation booking, online/EFT payment, amendments, cancellations, post-stay feedback |

---

## 2. SRS v1.0 Requirement Traceability Matrix (FR-001 to FR-162 & BR-001 to BR-015)

- **4.1 User Registration & Authentication (\`FR-001\`–\`FR-007\`)**: Implemented in \`src/lib/auth.ts\`, \`src/app/actions/auth.ts\`, \`/register\`, \`/login\`, \`/verify\`, \`/forgot-password\` (6-digit OTP verification, brute-force lockout after 5 failed attempts, account deactivation).
- **4.2 Residence & Accommodation Inventory (\`FR-008\`–\`FR-015\`)**: Implemented in \`src/lib/availability.ts\` and \`/admin/residences\` (Single, Double, Multiple-Sharing rooms & beds, temporary room restrictions, shared public/institutional inventory, overlap prevention).
- **4.3 Pricing Management (\`FR-016\`–\`FR-020\`)**: Implemented in \`src/lib/pricing.ts\` and \`/admin/pricing\` (flexible rules by residence, room type, season, group size discounts, min/max nights, and agreed price snapshot locking on \`Booking.agreedTotal\`).
- **4.4 Public Accommodation Booking (\`FR-021\`–\`FR-030\`)**: Implemented in \`/search\` and \`/book\` (seasonal June & December window enforcement, live availability & cost estimation prior to registration).
- **4.5 & 4.6 Institutional & Group Bookings (\`FR-031\`–\`FR-044\`)**: Implemented in \`/book\` and \`/account/bookings/[id]\` (year-round delegation requests, bulk CSV delegate upload with duplicate detection, per-delegate arrival/departure dates, single-residence capacity enforcement, individual delegate confirmation documents).
- **4.7 & 4.8 Room Allocation & Preferences (\`FR-045\`–\`FR-054\`)**: Automated bed allocation on confirmation plus manual officer allocation and preference status review (\`PENDING\`, \`APPROVED\`, \`PARTIALLY_ACCOMMODATED\`, \`DECLINED\`) in \`/admin/bookings\`.
- **4.9 & 4.10 Booking Status & Payment Management (\`FR-055\`–\`FR-071\`)**: Separate booking & payment statuses, instant online payment gateway simulation, EFT proof-of-payment upload with booking-specific references (\`DUT-...-PAY\`), Finance Officer verification, and official receipt numbering (\`RCP-...\`).
- **4.11 & 4.12 Cancellations, Refunds & Amendments (\`FR-072\`–\`FR-082\`)**: Automated refund calculation against \`CancellationPolicy\` tiers, availability release on cancellation, and booking amendments with live availability re-validation, cost recalculation, and before/after audit logging.
- **4.13 & 4.14 Guest Registration & Check-in/Check-out (\`FR-083\`–\`FR-096\`)**: Captures ID/Passport, emergency contacts, residence rule acceptance, actual arrival/departure timestamps, no-show/late arrival/early departure logging, and prevents automatic room release on checkout until cleaning inspection passes (\`BR-014\`).
- **4.15 Cleaning, Inspection & Maintenance (\`FR-097\`–\`FR-105\`)**: Implemented in \`/admin/operations\` (rooms transition to \`CLEANING\` on checkout and return to \`AVAILABLE\` only when marked \`INSPECTED\`; maintenance requests set rooms to \`UNDER_MAINTENANCE\`).
- **4.16 & 4.17 Guest Self-Service & Feedback (\`FR-106\`–\`FR-118\`)**: Implemented in \`/account\`, \`/account/bookings/[id]\`, and \`/account/bookings/[id]/document\` (printable WCAG-accessible invoices, confirmations, receipts, and 1–5 star post-stay feedback).
- **4.18–4.23 Website, Calendar, Dashboard, Notifications, Reports & Audit (\`FR-119\`–\`FR-162\`)**: Viewah-styled public portal, interactive availability calendar (\`/residences/[slug]\`), Admin Dashboard (\`/admin\`), Notifications log (\`/notifications\`), Reports & CSV exports (\`/admin/reports\`, \`/api/export\`), and searchable Audit Log (\`/admin/audit\`).

---

## 3. Migrating to PostgreSQL for Production (DUT ICT Hybrid Hosting)

1. In \`prisma/schema.prisma\`, change \`provider = "sqlite"\` to \`provider = "postgresql"\`.
2. Set \`DATABASE_URL="postgresql://user:password@host:5432/dut_amp?schema=public"\` and a strong \`SESSION_SECRET\` in \`.env\`.
3. Run \`npx prisma migrate deploy\` and \`npx tsx prisma/seed.ts\`.
`;
