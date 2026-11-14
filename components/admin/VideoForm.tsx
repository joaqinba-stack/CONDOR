"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import * as tus from "tus-js-client";
import { saveVideo } from "@/app/admin/actions";

interface Initial {
  id?: string;
  title?: string;
  description?: string;
  title_en?: string | null;
  description_en?: string | null;
  price_usd?: string;
  price_ars?: string;
  publish_when_ready?: boolean;
  hasFull?: boolean;
  hasTrailer?: boolean;
  cover_url?: string | null;
}

async function uploadToBunny(videoId: string, kind: "full" | "trailer", file: File, onProgress: (pct: number) => void) {
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

const label = "block text-mute";
const hint = "mt-1.5 block text-[0.8rem] text-dim";

export function VideoForm({ initial = {}, rate, uploadsEnabled, trailersEnabled }: {
  initial?: Initial;
  rate: number;
  uploadsEnabled: boolean;
  trailersEnabled: boolean;
}) {
  const router = useRouter();
  const [usd, setUsd] = useState(initial.price_usd ?? "");
  const [ars, setArs] = useState(initial.price_ars ?? "");
  const [arsTouched, setArsTouched] = useState(!!initial.price_ars);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ full?: number; trailer?: number }>({});
  const [step, setStep] = useState("");

  function onUsd(v: string) {
    setUsd(v);
    const n = Number(v.replace(",", "."));
    if (!arsTouched && Number.isFinite(n) && rate > 0) setArs(n > 0 ? String(Math.round(n * rate)) : "");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const full = form.get("file_full") as File | null;
    const trailer = form.get("file_trailer") as File | null;
    form.delete("file_full");
    form.delete("file_trailer");

    setBusy(true);
    try {
      setStep("Guardando la ficha…");
      const saved = await saveVideo(form);
      if (!saved.ok || !saved.id) throw new Error(saved.error ?? "No se pudo guardar");

      if (trailer && trailer.size > 0) {
        setStep("Subiendo el tráiler…");
        await uploadToBunny(saved.id, "trailer", trailer, (p) => setProgress((s) => ({ ...s, trailer: p })));
      }
      if (full && full.size > 0) {
        setStep("Subiendo el video completo… no cierres esta pestaña.");
        await uploadToBunny(saved.id, "full", full, (p) => setProgress((s) => ({ ...s, full: p })));
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[40rem] space-y-8">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <label className={label}>
        Título
        <input name="title" required maxLength={140} defaultValue={initial.title} className="field" />
      </label>

      <label className={label}>
        Descripción
        <textarea name="description" rows={4} defaultValue={initial.description} className="field resize-y" />
      </label>

      <div className="grid grid-cols-2 gap-5">
        <label className={label}>
          Precio en dólares (USD)
          <input
            name="price_usd"
            required
            inputMode="decimal"
            placeholder="15"
            value={usd}
            onChange={(e) => onUsd(e.target.value)}
            className="field"
          />
          <span className={hint}>Lo que se cobra por PayPal.</span>
        </label>
        <label className={label}>
          Precio en pesos (ARS)
          <input
            name="price_ars"
            required
            inputMode="numeric"
            placeholder="21750"
            value={ars}
            onChange={(e) => {
              setArs(e.target.value);
              setArsTouched(true);
            }}
            className="field"
          />
          <span className={hint}>Lo que se cobra por Mercado Pago. Se sugiere con la cotización {rate}.</span>
        </label>
      </div>

      <fieldset className="space-y-5 border-t border-line pt-6">
        <legend className="sr-only">Archivos</legend>
        <label className={label}>
          Video completo {initial.hasFull && <span className="text-fg">· ya cargado</span>}
          <input name="file_full" type="file" accept="video/*" disabled={!uploadsEnabled} className="field" />
          <span className={hint}>
            {uploadsEnabled
              ? "Es el que ve quien compra. Puede pesar varios GB: se sube directo y, si se corta, continúa."
              : "La subida se habilita cuando configures Bunny (ver README)."}
          </span>
          {progress.full !== undefined && <Bar pct={progress.full} />}
        </label>
        <label className={label}>
          Tráiler (opcional) {initial.hasTrailer && <span className="text-fg">· ya cargado</span>}
          <input name="file_trailer" type="file" accept="video/*" disabled={!trailersEnabled} className="field" />
          <span className={hint}>Clip corto, público, que se reproduce en la grilla. De acá sale también la portada.</span>
          {progress.trailer !== undefined && <Bar pct={progress.trailer} />}
        </label>
        <label className={label}>
          Portada (opcional) {initial.cover_url && <span className="text-fg">· ya cargada</span>}
          <input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="field" />
          <span className={hint}>JPG, PNG o WebP, hasta 4 MB. Necesaria si no subís tráiler.</span>
        </label>
      </fieldset>

      <details className="border-t border-line pt-6">
        <summary className="cursor-pointer text-mute hover:text-fg">Versión en inglés (opcional)</summary>
        <div className="mt-5 space-y-8">
          <label className={label}>
            Título en inglés
            <input name="title_en" maxLength={140} defaultValue={initial.title_en ?? ""} className="field" />
          </label>
          <label className={label}>
            Descripción en inglés
            <textarea name="description_en" rows={4} defaultValue={initial.description_en ?? ""} className="field resize-y" />
          </label>
        </div>
      </details>

      <label className="flex items-center gap-3 border-t border-line pt-6">
        <input type="checkbox" name="publish_when_ready" defaultChecked={initial.publish_when_ready ?? true} />
        Publicar automáticamente cuando termine de procesarse
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className="btn">
          {busy ? "Guardando…" : initial.id ? "Guardar cambios" : "Crear video"}
        </button>
        <p aria-live="polite" className={error ? "text-[#ff8a7a]" : "text-mute"}>
          {error ?? (busy ? step : "")}
        </p>
      </div>
    </form>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <span className="mt-2 flex items-center gap-3">
      <span className="h-px flex-1 bg-line">
        <span className="block h-px bg-fg transition-[width]" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-10 text-right text-[0.8rem] text-fg tabular-nums">{pct}%</span>
    </span>
  );
}
