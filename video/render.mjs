// Renderiza el video cuadro a cuadro: Playwright posiciona la animación en cada instante,
// saca la imagen y ffmpeg arma el MP4. Mismo resultado en cada corrida.
//
//   npm run video:render                 → video completo (con y sin audio)
//   node video/render.mjs --frames 3,12  → solo imágenes de esos segundos (para revisar)
//   node video/render.mjs --audio        → rehace solo la base sonora sobre el video ya renderizado
//
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(import.meta.dirname, "out");
const FRAMES = path.join(import.meta.dirname, ".frames");
const NAME = "condor-presentacion-9x16";
const WIDTH = 1080;
const HEIGHT = 1920;

if (!existsSync(path.join(import.meta.dirname, "captures", "meta.json"))) {
  console.error("Faltan las capturas: corré `npm run video:capture` primero.");
  process.exit(1);
}

// Servidor de archivos mínimo (solo lectura, solo dentro del proyecto).
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  const size = statSync(file).size;
  const head = { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Accept-Ranges": "bytes" };
  // Pedidos por rango: el navegador los necesita para posicionarse dentro de un video.
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    res.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...head, "Content-Length": size });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/video/composition/index.html`;

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} falló:\n${err.slice(-2000)}`))));
  });

/**
 * Base sonora simple y original: acorde sostenido con movimiento lento + un acento suave en
 * cada cambio de escena. Generada con ffmpeg, sin material de terceros.
 */
async function buildAudio(file, duration, cuts) {
  const notes = [110, 164.81, 220, 277.18, 329.63]; // La mayor abierto
  const inputs = [];
  const filters = [];
  notes.forEach((f, i) => {
    inputs.push("-f", "lavfi", "-t", String(duration), "-i", `sine=frequency=${f}:sample_rate=48000`);
    inputs.push("-f", "lavfi", "-t", String(duration), "-i", `sine=frequency=${(f * 1.004).toFixed(3)}:sample_rate=48000`);
    filters.push(`[${i * 2}:a][${i * 2 + 1}:a]amix=inputs=2:normalize=0,tremolo=f=${(0.12 + i * 0.05).toFixed(2)}:d=0.6,volume=${(0.16 - i * 0.02).toFixed(2)}[n${i}]`);
  });
  const base = notes.length * 2;
  const accents = cuts.filter((t) => t > 0.5);
  accents.forEach((t, i) => {
    inputs.push("-f", "lavfi", "-t", "1.6", "-i", `sine=frequency=${i % 2 ? 659.25 : 554.37}:sample_rate=48000`);
    filters.push(`[${base + i}:a]afade=t=in:d=0.02,afade=t=out:st=0.05:d=1.5,volume=0.11,adelay=${Math.round(t * 1000)}:all=1[a${i}]`);
  });
  const mix = [...notes.map((_, i) => `[n${i}]`), ...accents.map((_, i) => `[a${i}]`)].join("");
  filters.push(
    `${mix}amix=inputs=${notes.length + accents.length}:normalize=0,lowpass=f=2600,aecho=0.8:0.7:90|180:0.35|0.25,` +
      `volume=5.5,afade=t=in:d=1.5,afade=t=out:st=${(duration - 2).toFixed(2)}:d=2,alimiter=limit=0.7,aformat=channel_layouts=stereo[out]`,
  );
  await run("ffmpeg", ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", "[out]", "-t", String(duration), "-c:a", "aac", "-b:a", "160k", file]);
}

async function addAudio(silent, duration, cuts) {
  mkdirSync(FRAMES, { recursive: true });
  const audio = path.join(FRAMES, "base.m4a");
  await buildAudio(audio, duration, cuts);
  const withAudio = path.join(OUT, `${NAME}.mp4`);
  await run("ffmpeg", ["-y", "-i", silent, "-i", audio, "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", withAudio]);
  return withAudio;
}

if (process.argv.includes("--audio")) {
  const guion = JSON.parse(readFileSync(path.join(import.meta.dirname, "guion.json"), "utf8"));
  const silent = path.join(OUT, `${NAME}-sin-audio.mp4`);
  if (!existsSync(silent)) {
    console.error("Todavía no hay video renderizado: corré `npm run video:render`.");
    process.exit(1);
  }
  console.log(`Listo:\n  ${path.relative(ROOT, await addAudio(silent, guion.duracion, Object.values(guion.tiempos)))}`);
  server.close();
  process.exit(0);
}

const only = process.argv.includes("--frames") ? process.argv[process.argv.indexOf("--frames") + 1].split(",").map(Number) : null;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("Error en la composición:", e.message));
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => window.__ready);
  const { duration, fps, cuts } = await page.evaluate(() => ({ duration: window.__duration, fps: window.__fps, cuts: window.__cuts }));

  if (only) {
    mkdirSync(FRAMES, { recursive: true });
    for (const t of only) {
      await page.evaluate((s) => window.__seek(s), t);
      await page.screenshot({ path: path.join(FRAMES, `t${t.toFixed(2)}.png`) });
    }
    console.log(`Cuadros guardados en ${path.relative(ROOT, FRAMES)}/`);
  } else {
    mkdirSync(OUT, { recursive: true });
    const total = Math.round(duration * fps);
    const silent = path.join(OUT, `${NAME}-sin-audio.mp4`);
    const ffmpeg = spawn(
      "ffmpeg",
      ["-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
        "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-movflags", "+faststart", "-r", String(fps), silent],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let ffErr = "";
    ffmpeg.stderr.on("data", (d) => (ffErr += d));
    const done = new Promise((resolve, reject) =>
      ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg falló:\n${ffErr.slice(-2000)}`)))),
    );

    const started = Date.now();
    for (let i = 0; i < total; i++) {
      await page.evaluate((s) => window.__seek(s), i / fps);
      const png = await page.screenshot({ type: "png" });
      if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
      if (i % 150 === 0) process.stdout.write(`\r  cuadro ${i}/${total}`);
    }
    ffmpeg.stdin.end();
    await done;
    process.stdout.write(`\r  ${total} cuadros en ${Math.round((Date.now() - started) / 1000)} s\n`);

    const withAudio = await addAudio(silent, duration, cuts);
    console.log(`Listo:\n  ${path.relative(ROOT, withAudio)}\n  ${path.relative(ROOT, silent)}`);
  }
} finally {
  await browser.close();
  server.close();
}
