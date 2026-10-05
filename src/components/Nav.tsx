"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Trips", match: (p: string) => p === "/" || p.startsWith("/trips") },
  { href: "/lists", label: "Lists", match: (p: string) => p.startsWith("/lists") },
  { href: "/trip-types", label: "Trip types", match: (p: string) => p.startsWith("/trip-types") },
];

export default function Nav() {
  const path = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
          <span aria-hidden>🧳</span> Packing
        </Link>
        <nav className="ml-auto flex gap-1 rounded-xl bg-[var(--sunk)] p-1 text-sm">
          {TABS.map((t) => {
            const on = t.match(path);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3 py-1.5 font-semibold ${
                  on ? "bg-[var(--card)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
