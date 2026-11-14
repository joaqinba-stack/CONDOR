"use client";

export interface GalleryPhoto {
  id: string;
  url: string;
  width: number;
  height: number;
}

/**
 * Galería de un pack de fotos comprado. Las URLs llegan firmadas desde el servidor.
 * Sin botón de descarga, sin arrastrar y sin menú contextual (dificulta la copia; no impide
 * una captura de pantalla).
 */
export function PhotoGallery({ photos, title }: { photos: GalleryPhoto[]; title: string }) {
  return (
    <div className="flex flex-col items-center gap-2" onContextMenu={(e) => e.preventDefault()}>
      {photos.map((p, i) => (
        <div
          key={p.id}
          className="reveal relative w-full overflow-hidden bg-tile"
          style={
            {
              "--i": Math.min(i, 6),
              aspectRatio: `${p.width} / ${p.height}`,
              maxWidth: `calc((100dvh - 6rem) * ${p.width / p.height})`,
            } as React.CSSProperties
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt={`${title} ${i + 1}`}
            draggable={false}
            loading={i < 2 ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full select-none object-contain"
          />
        </div>
      ))}
    </div>
  );
}
