/**
 * Asocia un archivo de video completo con su producto, por nombre de archivo:
 * 1) si el nombre contiene el ID de ManyVids del producto, ese;
 * 2) si no, el título más parecido (palabras en común), si se parece lo suficiente.
 */
export interface MatchCandidate {
  id: string;
  title: string;
  manyvids_id: string | null;
}

const words = (s: string) =>
  new Set(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,4}$/, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1),
  );

export function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.max(A.size, B.size);
}

export function matchFile(fileName: string, products: MatchCandidate[], minScore = 0.6): { product: MatchCandidate; by: "id" | "titulo"; score: number } | null {
  const digits: string[] = fileName.match(/\d{6,}/g) ?? [];
  const byId = products.find((p) => p.manyvids_id && digits.includes(p.manyvids_id));
  if (byId) return { product: byId, by: "id", score: 1 };

  let best: { product: MatchCandidate; score: number } | null = null;
  for (const p of products) {
    const score = similarity(fileName, p.title);
    if (!best || score > best.score) best = { product: p, score };
  }
  return best && best.score >= minScore ? { ...best, by: "titulo" } : null;
}
