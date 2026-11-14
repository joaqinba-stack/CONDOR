"use client";

import { useEffect, useRef } from "react";

/** Punto gris que sigue al mouse y crece sobre lo clickeable. No se monta en pantallas táctiles. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.body.classList.add("has-dot-cursor");

    const move = (e: MouseEvent) => {
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      el.dataset.on = "1";
      const t = e.target as Element | null;
      el.dataset.hover = t?.closest("a, button, [data-cursor]") ? "1" : "0";
      el.dataset.text = t?.closest("input, textarea, select, iframe, video[controls]") ? "1" : "0";
    };
    const leave = () => (el.dataset.on = "0");

    window.addEventListener("mousemove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
      document.body.classList.remove("has-dot-cursor");
    };
  }, []);

  return <div ref={ref} className="dot-cursor" aria-hidden />;
}
