"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  external?: boolean;
}

export function NavLinks({ items, vertical }: { items: NavItem[]; vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className={vertical ? "flex flex-col" : "flex flex-wrap gap-x-5 gap-y-1"}>
      {items.map((it) => {
        const active = !it.external && (it.href === "/" ? pathname === "/" : pathname.startsWith(it.href));
        const cls = active ? "text-fg" : "text-mute hover:text-fg";
        return (
          <li key={it.href}>
            {it.external ? (
              <a href={it.href} className={cls}>
                {it.label}
              </a>
            ) : (
              <Link href={it.href} className={cls}>
                {it.label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
