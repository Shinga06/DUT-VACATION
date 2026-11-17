"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavUser = {
  id: string;
  name: string;
  email: string;
  roleName: string;
} | null;

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/residences", label: "Residences" },
  { href: "/search", label: "Explore & Book" },
  { href: "/faq", label: "FAQ" },
];

export default function Navbar({
  user,
  isStaff,
  notifCount,
  logoutAction,
}: {
  user: NavUser;
  isStaff: boolean;
  notifCount: number;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 pt-3 sm:pt-4 px-3 sm:px-6 print:hidden">
      <nav
        aria-label="Main"
        className="mx-auto max-w-7xl rounded-[26px] md:rounded-full border border-black/5 bg-white/95 px-3.5 sm:px-5 py-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.05)] backdrop-blur-md transition-all"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Brand Logo */}
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="group flex items-center gap-2.5 pl-0.5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#112a22] text-xs font-extrabold tracking-tight text-[#c8f560] transition-transform group-hover:scale-105">
              DUT
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-bold tracking-tight text-[#112a22]">
                DUT-AMP
              </span>
              <span className="hidden xl:inline text-xs font-medium text-neutral-500">
                · Student Housing
              </span>
            </div>
          </Link>

          {/* Desktop Center Navigation Pills */}
          <ul className="hidden md:flex items-center gap-1 rounded-full bg-[#f2f4ef] p-1 text-sm font-medium text-neutral-700">
            {PUBLIC_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`rounded-full px-4 py-1.5 transition ${
                      active
                        ? "bg-white font-semibold text-[#112a22] shadow-xs"
                        : "hover:bg-white/70 hover:text-[#112a22]"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            {isStaff && (
              <li>
                <Link
                  href="/admin"
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    pathname.startsWith("/admin")
                      ? "bg-[#112a22] text-[#c8f560] shadow-xs"
                      : "bg-[#112a22]/90 text-[#c8f560] hover:bg-[#112a22]"
                  }`}
                >
                  Admin Studio
                </Link>
              </li>
            )}
          </ul>

          {/* Desktop Right Auth / Account Actions */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link
                  className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition inline-flex items-center gap-1.5"
                  href="/notifications"
                >
                  <span>Inbox</span>
                  {notifCount > 0 && (
                    <span className="rounded-full bg-[#112a22] px-1.5 py-0.2 text-[10px] font-bold text-[#c8f560]">
                      {notifCount}
                    </span>
                  )}
                </Link>
                <Link
                  className="rounded-full bg-[#f2f4ef] px-3.5 py-1.5 text-xs font-semibold text-[#112a22] hover:bg-neutral-200/70 transition inline-flex items-center gap-1.5"
                  href="/account"
                >
                  <span className="max-w-[130px] truncate">{user.name}</span>
                  <span className="hidden lg:inline rounded-full bg-white px-2 py-0.5 text-[10px] text-neutral-600">
                    {user.roleName}
                  </span>
                </Link>
                <form action={logoutAction}>
                  <button className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  className="rounded-full px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 transition"
                  href="/login"
                >
                  Log in
                </Link>
                <Link
                  className="rounded-full bg-[#112a22] px-5 py-2 text-sm font-semibold text-[#c8f560] shadow-xs hover:bg-[#1a3d32] transition"
                  href="/register"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Right Quick Actions & Hamburger Button */}
          <div className="flex items-center gap-2 md:hidden">
            {user ? (
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-neutral-200 bg-[#f6f7f3] px-3 text-xs font-semibold text-[#112a22]"
              >
                <span>Inbox</span>
                {notifCount > 0 && (
                  <span className="rounded-full bg-[#112a22] px-1.5 text-[10px] font-bold text-[#c8f560]">
                    {notifCount}
                  </span>
                )}
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-full bg-[#f2f4ef] px-3.5 py-1.5 text-xs font-bold text-[#112a22]"
              >
                Log in
              </Link>
            )}

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#112a22] text-sm font-bold text-[#c8f560]"
            >
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {open && (
          <div className="mt-3 border-t border-neutral-100 pt-3 md:hidden space-y-3">
            {user && (
              <div className="flex items-center justify-between rounded-2xl bg-[#f6f7f3] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#112a22]">{user.name}</p>
                  <p className="truncate text-[11px] text-neutral-500">
                    {user.roleName} · {user.email}
                  </p>
                </div>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full bg-[#112a22] px-3 py-1 text-xs font-bold text-[#c8f560]"
                >
                  My Account
                </Link>
              </div>
            )}

            <ul className="grid grid-cols-2 gap-1.5 text-sm font-semibold">
              {PUBLIC_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-2xl px-3.5 py-2.5 transition ${
                        active
                          ? "bg-[#112a22] text-[#c8f560]"
                          : "bg-[#f2f4ef] text-[#112a22] hover:bg-neutral-200/70"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              {isStaff && (
                <li className="col-span-2">
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-2xl bg-[#112a22] px-4 py-2.5 text-xs font-bold text-[#c8f560]"
                  >
                    <span>Open Admin Command Studio</span>
                    <span>→</span>
                  </Link>
                </li>
              )}
            </ul>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-2.5">
              {user ? (
                <>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="text-xs font-bold text-[#112a22] underline"
                  >
                    Manage Bookings &amp; Profile
                  </Link>
                  <form action={logoutAction}>
                    <button className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-bold text-neutral-700">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-full bg-[#112a22] py-2.5 text-center text-xs font-bold text-[#c8f560]"
                >
                  Create Guest or Coordinator Account →
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
