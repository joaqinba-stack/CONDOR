"use client";

/**
 * Reproductor del video comprado.
 * - Producción: iframe de Bunny con URL firmada que vence (la genera el servidor).
 * - Modo demo: <video> con el clip de ejemplo.
 * Sin botón de descarga ni menú contextual.
 */
export function ProtectedPlayer({ embedUrl, demoSrc, title }: { embedUrl?: string; demoSrc?: string; title: string }) {
  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={title}
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }
  if (demoSrc) {
    return (
      <video
        src={demoSrc}
        controls
        loop
        playsInline
        disablePictureInPicture
        controlsList="nodownload noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 h-full w-full bg-black object-contain"
      />
    );
  }
  return null;
}
