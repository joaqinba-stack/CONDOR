"use client";

import { useMemo, useSyncExternalStore } from "react";
import { VideoTile, type TileData } from "./VideoTile";

const QUERIES = ["(min-width: 1024px)", "(min-width: 640px)"] as const;

function subscribe(cb: () => void) {
  const lists = QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", cb));
  return () => lists.forEach((l) => l.removeEventListener("change", cb));
}
const noop = () => () => {};
const columnsNow = () => (window.matchMedia(QUERIES[0]).matches ? 3 : window.matchMedia(QUERIES[1]).matches ? 2 : 1);

/**
 * Grilla tipo masonry. Reparte los tiles en 1, 2 o 3 columnas poniendo cada uno en la más
 * corta, así los más nuevos quedan arriba y las columnas terminan parejas.
 */
export function MasonryGrid({ tiles }: { tiles: TileData[] }) {
  const columns = useSyncExternalStore(subscribe, columnsNow, () => 3);
  // false en el servidor, true en el navegador: la grilla se muestra ya con las columnas correctas.
  const ready = useSyncExternalStore(noop, () => true, () => false);

  const cols = useMemo(() => {
    const out = Array.from({ length: columns }, () => ({ height: 0, items: [] as { tile: TileData; index: number }[] }));
    tiles.forEach((tile, index) => {
      const target = out.reduce((best, c) => (c.height < best.height ? c : best), out[0]);
      target.items.push({ tile, index });
      target.height += tile.height / tile.width + 0.09; // alto relativo + leyenda
    });
    return out;
  }, [tiles, columns]);

  return (
    <>
      <div className="masonry" data-ready={ready ? "" : undefined}>
        {cols.map((c, i) => (
          <div key={i}>
            {c.items.map(({ tile, index }) => (
              <VideoTile key={tile.href} data={tile} index={index} animate={ready} />
            ))}
          </div>
        ))}
      </div>
      <noscript>
        <style>{".masonry{visibility:visible!important}"}</style>
      </noscript>
    </>
  );
}
