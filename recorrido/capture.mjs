// Recorre la tienda en modo demo como lo haría un comprador y guarda una captura de cada paso.
// Requiere haber corrido antes `npm run build`.
//
//   npm run recorrido
//
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(import.meta.dirname, "out", "capturas");
const PORT = 3112;
const BASE = `http://localhost:${PORT}`;
const BUYER = "ana@email.com";
// Lo que compra en el recorrido: un video y un pack de fotos. Y un producto que NO compra.
const VIDEO = "tu-algoritmo";
const PACK = "jardin";
const NOT_BOUGHT = "retrato";

if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
  console.error("Falta compilar la app: corré `npm run build` primero.");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// Variables de la tienda vacías a propósito: fuerza el modo demo aunque exista un .env.local.
const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  cwd: ROOT,
  stdio: "ignore",
  detached: true,
  env: { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", NEXT_PUBLIC_SITE_URL: BASE },
});
const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {}
};
process.on("exit", stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("La app no levantó");
}

// Oculta los carteles propios del modo demo y apaga las animaciones de entrada.
const CLEAN = () => {
  const add = () => {
    const s = document.createElement("style");
    s.textContent =
      "[data-demo-banner],[data-demo]{display:none!important}.reveal{animation:none!important}.dot-cursor{display:none!important}";
    document.head.appendChild(s);
  };
  if (document.head) add();
  else document.addEventListener("DOMContentLoaded", add);
};

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const scrollTo = (page, y) => page.evaluate((v) => window.scrollTo(0, v), y);
const bottom = (page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

/** Compra desde la API de la tienda y aprueba el pago simulado. Devuelve el id de la orden. */
async function buy(page, slug, provider) {
  const res = await page.request.post(`${BASE}/api/checkout`, { data: { slug, email: BUYER, provider } });
  const { url } = await res.json();
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.click("text=Simular pago aprobado");
  await page.waitForURL("**/checkout/exito**");
  return new URL(page.url()).searchParams.get("orden");
}

await waitForServer();
const browser = await chromium.launch();

try {
  // ── Celular (pantalla completa de un iPhone) ────────────────────────
  const phone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } };
  const ctx = await browser.newContext({ ...phone, locale: "es-AR" });
  await ctx.addInitScript(CLEAN);
  await ctx.addCookies([{ name: "mayor_edad", value: "1", url: BASE }]); // pasa el aviso 18+
  const p = await ctx.newPage();

  // 01 · Entra a la tienda
  await p.goto(BASE, { waitUntil: "networkidle" });
  await settle(p);
  await shot(p, "01-inicio.png");

  // 02 · Recorre el catálogo (segundo producto: el video, con su adelanto en marcha)
  const tile = await p.locator(".masonry a").nth(1).evaluate((el) => el.getBoundingClientRect().y + scrollY);
  await scrollTo(p, tile - 330);
  await settle(p, 1600);
  await shot(p, "02-catalogo.png");

  // 03 · Página del producto
  await p.goto(`${BASE}/v/${VIDEO}`, { waitUntil: "networkidle" });
  await settle(p, 1400);
  await shot(p, "03-detalle.png");

  // 04 · Email y medio de pago
  await p.fill("input[name=email]", BUYER);
  await p.locator("input[name=email]").blur();
  await bottom(p);
  await settle(p, 500);
  await shot(p, "04-compra.png");

  // 05 · Paga (en el sitio real: checkout de Mercado Pago / PayPal) y vuelve a la tienda
  const order = await buy(p, VIDEO, "mercadopago");
  await settle(p);
  await shot(p, "05-confirmacion.png");

  // 06 · El email que recibe
  await p.goto(`${BASE}/checkout/demo/email?orden=${order}`, { waitUntil: "networkidle" });
  // El texto visible del email muestra la dirección del sitio: en la captura va la genérica,
  // no la de esta computadora. (El link del botón no se toca: se usa en el paso siguiente.)
  await p.evaluate((base) => {
    for (const a of document.querySelectorAll("a")) {
      if (a.textContent.includes(base)) a.textContent = a.textContent.replace(base, "https://tudominio.com");
    }
  }, BASE);
  await settle(p, 400);
  await shot(p, "06-email.png");

  // 07 · Toca el botón del email → confirma para entrar
  await p.click("a >> nth=0");
  await p.waitForURL("**/auth/confirm**");
  await settle(p);
  await shot(p, "07-entrar.png");

  // 08 · Mira el video
  await p.click('button:has-text("Entrar")');
  await p.waitForURL(`**/ver/${VIDEO}`);
  await p.locator("video").evaluate(async (v) => {
    v.muted = true;
    await v.play().catch(() => {});
  });
  await settle(p, 2600);
  await p.locator("video").evaluate((v) => v.pause());
  await shot(p, "08-video.png");

  // 09 · Compra un pack de fotos y lo ve en la galería
  await buy(p, PACK, "paypal");
  await p.goto(`${BASE}/ver/${PACK}`, { waitUntil: "networkidle" });
  await settle(p, 1200);
  await shot(p, "09-fotos.png");

  // 10 · Su biblioteca
  await p.goto(`${BASE}/biblioteca`, { waitUntil: "networkidle" });
  await settle(p, 1400);
  await shot(p, "10-biblioteca.png");

  // 11 · Un producto que no compró
  await p.goto(`${BASE}/ver/${NOT_BOUGHT}`, { waitUntil: "networkidle" });
  await settle(p);
  await shot(p, "11-bloqueado.png");

  // 12 · Un comprador de otro país (navegador en inglés)
  const en = await browser.newContext({ ...phone, locale: "en-US" });
  await en.addInitScript(CLEAN);
  await en.addCookies([{ name: "mayor_edad", value: "1", url: BASE }]); // pasa el aviso 18+
  const e = await en.newPage();
  await e.goto(`${BASE}/v/${VIDEO}`, { waitUntil: "networkidle" });
  await bottom(e);
  await settle(e, 700);
  await shot(e, "12-ingles.png");

  // ── Computadora ─────────────────────────────────────────────────────
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "es-AR" });
  await desk.addInitScript(CLEAN);
  await desk.addCookies([{ name: "mayor_edad", value: "1", url: BASE }]); // pasa el aviso 18+
  const d = await desk.newPage();
  await d.goto(BASE, { waitUntil: "networkidle" });
  await settle(d, 1200);
  await shot(d, "13-escritorio-inicio.png");
  await d.goto(`${BASE}/v/${VIDEO}`, { waitUntil: "networkidle" });
  await settle(d, 1400);
  await shot(d, "14-escritorio-detalle.png");

  console.log(`Capturas guardadas en ${path.relative(ROOT, OUT)}/`);
} finally {
  await browser.close();
  stop();
}
