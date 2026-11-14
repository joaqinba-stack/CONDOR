import * as tus from "tus-js-client";

/**
 * (Navegador) Sube un archivo de video directo a Bunny con subida reanudable.
 * Pide al servidor un permiso firmado para ese producto; la API key nunca llega al navegador.
 */
export async function uploadToBunny(
  videoId: string,
  kind: "full" | "trailer",
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const res = await fetch("/api/admin/upload-ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, kind }),
  });
  const ticket = (await res.json()) as { endpoint?: string; headers?: Record<string, string>; error?: string };
  if (!res.ok || !ticket.endpoint || !ticket.headers) throw new Error(ticket.error ?? "No se pudo preparar la subida");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: ticket.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      headers: ticket.headers,
      metadata: { filetype: file.type || "video/mp4", title: file.name },
      onError: reject,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}
