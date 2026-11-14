import type { Metadata } from "next";
import { AgeGate } from "@/components/AgeGate";
import { dict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Lo muestra proxy.ts en lugar de cualquier página mientras no se confirme la mayoría de edad. */
export default async function AgePage() {
  return <AgeGate t={dict(await getLocale())} />;
}
