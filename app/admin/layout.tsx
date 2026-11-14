import type { Metadata } from "next";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { env } from "@/lib/env";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdmin();
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2 px-4 pt-4 md:px-5">
        <Link href="/">{env.siteName}</Link>
        <nav className="flex flex-wrap gap-x-5">
          <NavLinks
            items={[
              { href: "/admin/videos", label: "Productos" },
              { href: "/admin/ventas", label: "Ventas" },
              { href: "/admin/ajustes", label: "Ajustes" },
            ]}
          />
          <span className="text-dim">{email}</span>
        </nav>
      </header>
      <main className="px-4 pb-24 pt-14 md:px-5">{children}</main>
    </>
  );
}
