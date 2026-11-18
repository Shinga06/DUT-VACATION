import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "DUT-AMP · Durban University of Technology Accommodation Platform",
  description:
    "Discover and book peaceful university residences, guest houses, and conference delegation stays at Durban University of Technology.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#112a22",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const isStaff = user ? hasPermission(user.permissions, "dashboard.view") : false;
  let notifCount = 0;
  if (user) {
    try {
      notifCount = await db.notification.count({
        where: isStaff ? {} : { toEmail: user.email },
      });
    } catch {
      notifCount = 0;
    }
  }

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#f6f7f3] text-[#111815] antialiased overflow-x-hidden">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#112a22] focus:px-5 focus:py-2.5 focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>

        <Navbar
          user={
            user
              ? {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  roleName: user.roleName,
                }
              : null
          }
          isStaff={isStaff}
          notifCount={notifCount}
          logoutAction={logout}
        />

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 py-5 sm:py-6">
          {children}
        </main>

        {/* Responsive Editorial Footer */}
        <footer className="mt-12 sm:mt-16 px-3 sm:px-6 pb-5 sm:pb-6 print:hidden">
          <div className="mx-auto max-w-7xl rounded-[24px] sm:rounded-[28px] bg-[#112a22] px-6 sm:px-8 py-10 sm:py-12 text-neutral-200">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 font-bold text-white text-lg">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#c8f560] text-xs font-black text-[#112a22]">
                    DUT
                  </span>
                  DUT-AMP
                </div>
                <p className="text-xs text-neutral-300/80 leading-relaxed">
                  Durban University of Technology&apos;s centralised accommodation platform for June &amp; December holiday
                  stays and year-round visiting delegations.
                </p>
              </div>
              <div>
                <h2 className="font-semibold text-[#c8f560] text-xs uppercase tracking-wider mb-3">
                  Explore
                </h2>
                <ul className="space-y-2 text-xs text-neutral-300">
                  <li><Link className="hover:text-white transition" href="/residences">Residences &amp; Guest Houses</Link></li>
                  <li><Link className="hover:text-white transition" href="/search">Live Availability &amp; Pricing</Link></li>
                  <li><Link className="hover:text-white transition" href="/register">Institutional Coordinator Portal</Link></li>
                  <li><Link className="hover:text-white transition" href="/faq">FAQs &amp; Residence Rules</Link></li>
                </ul>
              </div>
              <div>
                <h2 className="font-semibold text-[#c8f560] text-xs uppercase tracking-wider mb-3">
                  Durban Campuses
                </h2>
                <ul className="space-y-2 text-xs text-neutral-300">
                  <li>Ritson Campus · Berea, Durban</li>
                  <li>Steve Biko Campus · Musgrave, Durban</li>
                  <li>ML Sultan Guest House · Centenary Rd</li>
                  <li>Support: housing-support@dut.ac.za</li>
                </ul>
              </div>
              <div>
                <h2 className="font-semibold text-[#c8f560] text-xs uppercase tracking-wider mb-3">
                  Standards &amp; Governance
                </h2>
                <p className="text-xs text-neutral-300/80 leading-relaxed">
                  Operated by the DUT Student Housing Department with Finance &amp; ICT support. Compliant with POPIA
                  privacy controls and WCAG 2.2 AA accessibility.
                </p>
              </div>
            </div>
            <div className="mt-8 sm:mt-10 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400 text-center sm:text-left">
              <span>© {new Date().getFullYear()} Durban University of Technology · Student Housing Department</span>
              <span>Official University Accommodation Portal</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
