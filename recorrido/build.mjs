// Arma las láminas del recorrido del comprador a partir de las capturas y de pasos.json:
// una imagen por paso (1080×1350), una portada, una hoja con todos los pasos y un PDF.
//
//   npm run recorrido
//
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(HERE, "out");
const SLIDES = path.join(OUT, "laminas");
const W = 1080;
const H = 1350;

const data = JSON.parse(readFileSync(path.join(HERE, "pasos.json"), "utf8"));
const missing = data.pasos.filter((p) => !existsSync(path.join(OUT, "capturas", p.archivo)));
if (missing.length) {
  console.error(`Faltan capturas (${missing.map((p) => p.archivo).join(", ")}): corré primero recorrido/capture.mjs.`);
  process.exit(1);
}
mkdirSync(SLIDES, { recursive: true });

const brand = process.env.NEXT_PUBLIC_SITE_NAME || "Condor";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const font = pathToFileURL(path.join(ROOT, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"));
const total = data.pasos.length;
const nn = (i) => String(i + 1).padStart(2, "0");

const statusbar = `<div class="statusbar"><span>9:41</span><span class="sb"><i class="sig"></i><i class="bat"></i></span></div>`;

const slide = (p, i) => `
<section class="slide ${p.escritorio ? "desk" : ""}" id="s${nn(i)}">
  <div class="copy">
    <p class="num">${nn(i)} <span>/ ${total}</span></p>
    <h2>${esc(p.titulo)}</h2>
    <p class="text">${esc(p.texto)}</p>
  </div>
  ${
    p.escritorio
      ? `<div class="window"><div class="bar"><i></i><i></i><i></i></div><img src="capturas/${p.archivo}" alt=""></div>`
      : `<div class="phone"><div class="screen">${statusbar}<img src="capturas/${p.archivo}" alt=""></div></div>`
  }
  <p class="foot">${esc(brand)} · ${esc(data.titulo)}</p>
</section>`;

const cover = `
<section class="slide cover" id="s00">
  <div class="thumbs">${data.pasos
    .filter((p) => !p.escritorio)
    .slice(0, 8)
    .map((p) => `<img src="capturas/${p.archivo}" alt="">`)
    .join("")}</div>
  <div class="veil"></div>
  <p class="num">${esc(brand)}</p>
  <h1>${esc(data.titulo)}</h1>
  <p class="text">${esc(data.subtitulo)}</p>
</section>`;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(brand)} — ${esc(data.titulo)}</title>
<style>
@font-face { font-family: "Inter Variable"; font-weight: 100 900; font-display: block; src: url("${font}") format("woff2-variations"); }
@page { size: ${W}px ${H}px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #000; }
body { font-family: "Inter Variable", system-ui, sans-serif; font-feature-settings: "ss01", "cv11"; color: #f2f2f2; -webkit-font-smoothing: antialiased; }
.slide { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #0a0a0a; break-after: page; }
.copy { position: absolute; left: 72px; top: 0; bottom: 0; width: 400px; display: flex; flex-direction: column; justify-content: center; }
.num { font-size: 26px; color: #f2f2f2; font-variant-numeric: tabular-nums; }
.num span { color: #5c5c5c; }
h2 { margin-top: 26px; font-size: 54px; line-height: 1.05; font-weight: 500; letter-spacing: -0.035em; }
.text { margin-top: 26px; font-size: 27px; line-height: 1.35; color: #8c8c8c; }
.foot { position: absolute; left: 72px; bottom: 56px; font-size: 20px; color: #5c5c5c; }

.phone { position: absolute; right: 72px; top: 50%; width: 478px; margin-top: -535px; padding: 12px; border-radius: 68px; background: #1c1c1c; box-shadow: inset 0 0 0 2px #333, 0 50px 120px rgba(0,0,0,.7); }
.screen { position: relative; width: 454px; height: 1046px; overflow: hidden; border-radius: 57px; background: #0a0a0a; }
.screen::before { content: ""; position: absolute; z-index: 3; left: 50%; top: 14px; width: 130px; height: 36px; margin-left: -65px; border-radius: 20px; background: #000; }
.screen > img { position: absolute; left: 0; top: 64px; width: 454px; display: block; }
.statusbar { position: absolute; z-index: 2; inset: 0 0 auto 0; height: 64px; padding: 20px 44px 0 48px; display: flex; justify-content: space-between; font-size: 21px; font-weight: 600; background: #0a0a0a; }
.sb { display: flex; align-items: center; gap: 10px; height: 26px; }
.sig { width: 24px; height: 16px; background: linear-gradient(90deg, #f2f2f2 0 4px, transparent 4px 6.5px, #f2f2f2 6.5px 10.5px, transparent 10.5px 13px, #f2f2f2 13px 17px, transparent 17px 19.5px, #f2f2f2 19.5px 24px); clip-path: polygon(0 60%, 100% 0, 100% 100%, 0 100%); }
.bat { width: 34px; height: 17px; border-radius: 5px; background: #f2f2f2; }

.desk .copy { top: 150px; bottom: auto; width: 936px; display: block; }
.desk h2 { max-width: 820px; }
.desk .text { max-width: 760px; }
.window { position: absolute; left: 72px; top: 560px; width: 936px; border-radius: 22px; overflow: hidden; background: #1c1c1c; box-shadow: inset 0 0 0 2px #333, 0 50px 120px rgba(0,0,0,.7); }
.window .bar { display: flex; gap: 9px; padding: 16px 20px; }
.window .bar i { width: 13px; height: 13px; border-radius: 50%; background: #3a3a3a; }
.window img { display: block; width: 100%; }

.cover .thumbs { position: absolute; inset: -40px -60px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; opacity: .34; transform: rotate(-4deg) scale(1.12); }
.cover .thumbs img { width: 100%; display: block; border-radius: 26px; }
.cover .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,10,10,.55), rgba(10,10,10,.2) 35%, rgba(10,10,10,.96) 78%); }
.cover .num, .cover h1, .cover .text { position: absolute; left: 72px; }
.cover .num { bottom: 420px; font-size: 30px; }
.cover h1 { bottom: 210px; width: 900px; font-size: 104px; line-height: 1; font-weight: 500; letter-spacing: -0.045em; }
.cover .text { bottom: 110px; width: 800px; font-size: 32px; margin: 0; }

/* Hoja resumen */
.sheet { width: ${W * 2}px; padding: 90px 80px 100px; background: #0a0a0a; break-after: page; }
.sheet h1 { font-size: 84px; font-weight: 500; letter-spacing: -0.04em; }
.sheet .text { margin-top: 18px; font-size: 34px; }
.sheet .grid { margin-top: 70px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 54px 34px; }
.sheet figure img { width: 100%; display: block; border-radius: 22px; box-shadow: 0 0 0 2px #262626; }
.sheet figcaption { margin-top: 16px; font-size: 24px; line-height: 1.25; }
.sheet figcaption b { display: block; font-weight: 400; color: #5c5c5c; font-size: 20px; margin-bottom: 4px; }
@media print { .sheet { display: none; } }
</style></head>
<body>
${cover}
${data.pasos.map(slide).join("\n")}
<section class="sheet" id="hoja">
  <h1>${esc(data.titulo)}</h1>
  <p class="text">${esc(data.subtitulo)}</p>
  <div class="grid">${data.pasos
    .filter((p) => !p.escritorio)
    .map((p, i) => `<figure><img src="capturas/${p.archivo}" alt=""><figcaption><b>${nn(i)}</b>${esc(p.titulo)}</figcaption></figure>`)
    .join("")}</div>
</section>
</body></html>`;

const file = path.join(OUT, "recorrido.html");
writeFileSync(file, html);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: W * 2, height: H }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  });

  await page.locator("#s00").screenshot({ path: path.join(SLIDES, "00-portada.png") });
  for (let i = 0; i < total; i++) {
    await page.locator(`#s${nn(i)}`).screenshot({ path: path.join(SLIDES, data.pasos[i].archivo) });
  }
  await page.locator("#hoja").screenshot({ path: path.join(OUT, "resumen.png") });

  // PDF liviano (para mandar por WhatsApp o mail): una lámina por página, en JPEG.
  const pages = [];
  for (const id of ["s00", ...data.pasos.map((_, i) => `s${nn(i)}`)]) {
    const jpg = await page.locator(`#${id}`).screenshot({ type: "jpeg", quality: 88 });
    pages.push(`<img src="data:image/jpeg;base64,${jpg.toString("base64")}">`);
  }
  await page.setContent(
    `<style>@page{size:${W}px ${H}px;margin:0}*{margin:0}img{display:block;width:${W}px;height:${H}px;break-after:page}</style>${pages.join("")}`,
    { waitUntil: "load" },
  );
  await page.pdf({ path: path.join(OUT, "recorrido-del-comprador.pdf"), width: `${W}px`, height: `${H}px`, printBackground: true });
  console.log(`Listo: ${total + 1} láminas en ${path.relative(ROOT, SLIDES)}/, resumen.png y PDF en ${path.relative(ROOT, OUT)}/`);
} finally {
  await browser.close();
}
