"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Vuelve a pedir la página cada unos segundos (mientras el pago está pendiente). */
export function AutoRefresh({ everyMs = 4000, max = 45 }: { everyMs?: number; max?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (++n > max) return clearInterval(id);
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, max]);
  return null;
}
