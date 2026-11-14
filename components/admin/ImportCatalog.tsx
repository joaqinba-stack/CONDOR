"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { importCatalogItem, type CatalogItem, type ImportResult } from "@/app/admin/importar/actions";

type Row = { item: CatalogItem; result?: ImportResult };

export function ImportCatalog() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = rows.filter((r) => r.result).length;

  async function onFile(file: File | undefined) {
    setError(null);
    setRows([]);
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { productos?: CatalogItem[] };
      if (!Array.isArray(data.productos) || data.productos.length === 0) throw new Error("El archivo no tiene productos.");
      setRows(data.productos.map((item) => ({ item })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
  }

  async function run() {
    setBusy(true);
    for (let i = 0; i < rows.length; i++) {
      let result: ImportResult;
      try {
        result = await importCatalogItem(rows[i].item);
      } catch (err) {
        result = { status: "error", message: err instanceof Error ? err.message : "error" };
      }
      setRows((prev) => prev.map((r, n) => (n === i ? { ...r, result } : r)));
    }
    setBusy(false);
    router.refresh();
  }

  const count = (s: ImportResult["status"]) => rows.filter((r) => r.result?.status === s).length;

  return (
    <div className="space-y-5">
      <input type="file" accept="application/json,.json" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} className="field" />
      {error && <p className="text-[#ff8a7a]">{error}</p>}
      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="btn" disabled={busy || done === rows.length} onClick={run}>
              {busy ? `Importando ${done}/${rows.length}…` : done === rows.length ? "Listo" : `Importar ${rows.length} productos`}
            </button>
            {done > 0 && (
              <p className="text-mute">
                {count("creado")} creados · {count("ya_estaba")} ya estaban · {count("error")} con error
              </p>
            )}
          </div>
          <ul className="max-h-[26rem] divide-y divide-line overflow-auto border-y border-line text-[0.85rem]">
            {rows.map(({ item, result }) => (
              <li key={item.manyvids_id} className="flex items-baseline justify-between gap-4 py-2">
                <span className="min-w-0 truncate">
                  {item.titulo} <span className="text-dim">· US$ {item.precio_usd}</span>
                </span>
                <span className={`shrink-0 ${result?.status === "error" ? "text-[#ff8a7a]" : "text-mute"}`}>
                  {!result
                    ? ""
                    : result.status === "creado"
                      ? result.warnings?.length
                        ? `Creado (sin ${result.warnings.map((w) => w.split(":")[0]).join(" ni ")})`
                        : "Creado"
                      : result.status === "ya_estaba"
                        ? "Ya estaba"
                        : `Error: ${result.message}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
