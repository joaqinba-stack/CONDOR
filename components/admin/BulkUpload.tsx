"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { matchFile, type MatchCandidate } from "@/lib/match";
import { uploadToBunny } from "@/lib/upload-client";

type Row = {
  file: File;
  productId: string; // "" = no subir
  by: "id" | "titulo" | "manual" | null;
  progress?: number;
  error?: string;
  done?: boolean;
};

const size = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.round(b / 1e6)} MB`);

export function BulkUpload({ products, enabled }: { products: MatchCandidate[]; enabled: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  function onFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("video/") || /\.(mov|mp4|m4v|mkv|avi|webm)$/i.test(f.name));
    const taken = new Set<string>();
    setRows(
      files.map((file) => {
        const m = matchFile(file.name, products.filter((p) => !taken.has(p.id)));
        if (m) taken.add(m.product.id);
        return { file, productId: m?.product.id ?? "", by: m?.by ?? null };
      }),
    );
  }

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  async function run() {
    setBusy(true);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.productId || r.done) continue;
      try {
        await uploadToBunny(r.productId, "full", r.file, (p) => update(i, { progress: p }));
        update(i, { done: true, progress: 100 });
      } catch (err) {
        update(i, { error: err instanceof Error ? err.message : "error" });
      }
    }
    setBusy(false);
    router.refresh();
  }

  if (!enabled) {
    return <p className="text-dim">La subida se habilita cuando configures Bunny (ver README).</p>;
  }
  if (products.length === 0) {
    return <p className="text-dim">No hay productos esperando su video completo.</p>;
  }

  const selected = rows.filter((r) => r.productId);
  const dupes = new Set(selected.map((r) => r.productId).filter((id, i, a) => a.indexOf(id) !== i));

  return (
    <div className="space-y-5">
      <p className="text-[0.85rem] text-dim">{products.length} productos esperan su video completo.</p>
      <input type="file" multiple accept="video/*" disabled={busy} onChange={(e) => onFiles(e.target.files)} className="field" />
      {rows.length > 0 && (
        <>
          <ul className="divide-y divide-line border-y border-line text-[0.85rem]">
            {rows.map((r, i) => (
              <li key={r.file.name + i} className="space-y-1.5 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="min-w-0 truncate">
                    {r.file.name} <span className="text-dim">· {size(r.file.size)}</span>
                  </span>
                  <span className="text-dim">{r.by === "id" ? "por número" : r.by === "titulo" ? "por título, revisalo" : ""}</span>
                </div>
                <select
                  value={r.productId}
                  disabled={busy || r.done}
                  onChange={(e) => update(i, { productId: e.target.value, by: "manual" })}
                  className={`field py-1 ${dupes.has(r.productId) ? "text-[#ff8a7a]" : ""}`}
                >
                  <option value="" className="bg-bg">
                    — No subir —
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} className="bg-bg">
                      {p.title}
                      {p.manyvids_id ? ` (#${p.manyvids_id})` : ""}
                    </option>
                  ))}
                </select>
                {r.progress !== undefined && !r.error && (
                  <span className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-line">
                      <span className="block h-px bg-fg" style={{ width: `${r.progress}%` }} />
                    </span>
                    <span className="w-10 text-right tabular-nums">{r.done ? "✓" : `${r.progress}%`}</span>
                  </span>
                )}
                {r.error && <p className="text-[#ff8a7a]">{r.error}</p>}
              </li>
            ))}
          </ul>
          {dupes.size > 0 && <p className="text-[#ff8a7a]">Hay archivos asignados al mismo producto: corregilo antes de subir.</p>}
          <button type="button" className="btn" disabled={busy || selected.length === 0 || dupes.size > 0} onClick={run}>
            {busy ? "Subiendo… no cierres esta pestaña" : `Subir ${selected.length} videos`}
          </button>
        </>
      )}
    </div>
  );
}
