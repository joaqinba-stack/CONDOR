// Baja la portada (captura) y el adelanto PÚBLICOS de cada producto de catalogo.json y prepara
// las versiones para la tienda. No baja los videos completos (no son públicos).
//
//   NODE_USE_ENV_PROXY=1 node importar/medios.mjs   (la variable solo hace falta detrás de un proxy)
//
// Salida por producto en importar/out/medios/<manyvids_id>/:
//   portada.jpg          captura original
//   adelanto.mp4         adelanto original
//   cover.jpg            portada para la tienda (máx. 900 px)
//   trailer.mp4          6 s sin sonido para la grilla
//   preview.mp4          adelanto liviano para la página del producto
// Si se corta, al volver a correrlo sigue desde donde quedó.
import { spawnSync } from "node:child_process";
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const OUT = path.join(import.meta.dirname, "out");
const MEDIA = path.join(OUT, "medios");
const PAUSE_MS = 1500;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Referer: "https://www.manyvids.com/",
};

const src = path.join(OUT, "catalogo.json");
if (!existsSync(src)) {
  console.error("Falta importar/out/catalogo.json: corré primero `node importar/preparar.mjs`.");
  process.exit(1);
}
const { productos } = JSON.parse(readFileSync(src, "utf8"));
mkdirSync(MEDIA, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (f) => existsSync(f) && statSync(f).size > 0;

/** Baja un archivo a disco (primero a .part, después lo renombra). */
async function download(url, file) {
  if (has(file)) return "ya estaba";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(file + ".part"));
      renameSync(file + ".part", file);
      return "bajado";
    } catch (err) {
      if (existsSync(file + ".part")) unlinkSync(file + ".part");
      if (attempt === 3) throw err;
      await sleep(PAUSE_MS * attempt * 2);
    }
  }
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args]);
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-500));
}

const failed = [];
for (const [i, p] of productos.entries()) {
  const dir = path.join(MEDIA, p.manyvids_id);
  mkdirSync(dir, { recursive: true });
  const portada = path.join(dir, "portada.jpg");
  const adelanto = path.join(dir, "adelanto.mp4");
  try {
    const a = p.portada_url ? await download(p.portada_url, portada) : "sin dirección";
    const b = p.adelanto_url ? await download(p.adelanto_url, adelanto) : "sin dirección";

    if (has(portada) && !has(path.join(dir, "cover.jpg"))) {
      ffmpeg(["-i", portada, "-vf", "scale='min(900,iw)':-2", "-q:v", "4", path.join(dir, "cover.jpg")]);
    }
    if (has(adelanto) && !has(path.join(dir, "trailer.mp4"))) {
      ffmpeg(["-i", adelanto, "-t", "6", "-an", "-vf", "scale='min(540,iw)':-2,format=yuv420p", "-c:v", "libx264", "-crf", "29",
        "-preset", "slow", "-movflags", "+faststart", path.join(dir, "trailer.mp4")]);
    }
    if (has(adelanto) && !has(path.join(dir, "preview.mp4"))) {
      ffmpeg(["-i", adelanto, "-vf", "scale='min(720,iw)':-2,format=yuv420p", "-c:v", "libx264", "-crf", "27", "-preset", "slow",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", path.join(dir, "preview.mp4")]);
    }
    console.log(`${String(i + 1).padStart(2)}/${productos.length} ${p.manyvids_id}  portada: ${a}, adelanto: ${b}`);
    if (a === "bajado" || b === "bajado") await sleep(PAUSE_MS);
  } catch (err) {
    failed.push(p.manyvids_id);
    console.log(`${String(i + 1).padStart(2)}/${productos.length} ${p.manyvids_id}  ERROR: ${err.message}`);
  }
}

const done = productos.filter((p) => ["cover.jpg", "trailer.mp4", "preview.mp4"].every((f) => has(path.join(MEDIA, p.manyvids_id, f))));
console.log(`\nListos: ${done.length}/${productos.length}`);

// Copia las versiones para la tienda a public/demo/mv/<id>/, donde las toma el modo demo
// (lib/store/fixtures.ts). Esa carpeta no se versiona.
const DEMO = path.join(import.meta.dirname, "..", "public", "demo", "mv");
for (const p of done) {
  const dest = path.join(DEMO, p.manyvids_id);
  mkdirSync(dest, { recursive: true });
  for (const f of ["cover.jpg", "trailer.mp4", "preview.mp4"]) copyFileSync(path.join(MEDIA, p.manyvids_id, f), path.join(dest, f));
}
console.log(`Copiados a public/demo/mv/ para el modo demo: ${done.length}`);
if (failed.length) console.log(`Con error: ${failed.join(", ")} (volvé a correr el script para reintentar)`);
