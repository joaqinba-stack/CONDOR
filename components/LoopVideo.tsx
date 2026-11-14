"use client";

/** Tráiler en loop, sin sonido ni controles (vista de detalle). */
export function LoopVideo({ src, poster }: { src: string; poster?: string | null }) {
  return (
    <video
      src={src}
      poster={poster ?? undefined}
      autoPlay
      muted
      loop
      playsInline
      disablePictureInPicture
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
