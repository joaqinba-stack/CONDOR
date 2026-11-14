"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface TileData {
  href: string;
  title: string;
  /** "Video · 0:10" o "2 fotos" */
  kind: string;
  meta: string;
  cover: string | null;
  trailer: string | null;
  width: number;
  height: number;
}

/** Tile de la grilla: portada fija; el tráiler se reproduce en silencio al pasar el mouse
 *  (o al entrar en pantalla en dispositivos táctiles). */
export function VideoTile({ data, index, animate = true }: { data: TileData; index: number; animate?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLAnchorElement>(null);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !data.trailer) return;
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.intersectionRatio >= 0.7), {
      threshold: [0, 0.7, 1],
    });
    io.observe(box);
    return () => io.disconnect();
  }, [data.trailer]);

  return (
    <Link
      ref={boxRef}
      href={data.href}
      className={`${animate ? "reveal" : ""} group block bg-tile`}
      style={{ "--i": Math.min(index, 12) } as React.CSSProperties}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: `${data.width} / ${data.height}` }}>
        {data.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.cover}
            alt=""
            loading={index < 6 ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {data.trailer && (
          <video
            ref={videoRef}
            src={active || playing ? data.trailer : undefined}
            muted
            loop
            playsInline
            preload="none"
            onPlaying={() => setPlaying(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              active && playing ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </div>
      <div className="flex items-baseline justify-between gap-4 px-2.5 pb-3 pt-2 text-[0.8rem] leading-tight">
        <span className="text-fg">
          {data.title}
          <span className="text-dim"> · {data.kind}</span>
        </span>
        <span className="text-mute transition-colors group-hover:text-fg">{data.meta}</span>
      </div>
    </Link>
  );
}
