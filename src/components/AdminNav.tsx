"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export default function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin Studio"
      className="-mx-2 flex items-center gap-2 overflow-x-auto px-2 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 text-xs font-semibold no-scrollbar"
    >
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-4 py-2 transition ${
              active
                ? "bg-[#c8f560] font-bold text-[#112a22] shadow-xs"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
