// Levanta la tienda en modo demo, recorre el flujo de compra y guarda las capturas
// que se usan dentro del video. Requiere haber corrido antes `npm run build`.
//
//   npm run video:capture
//
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(import.meta.dirname, "captures");
const PORT = 3111;
const BASE = `http://localhost:${PORT}`;
const BUYER = "ana@email.com";
const ADMIN = "admin@demo.local";
// El video protagonista: el que se toca en la grilla, se compra y se reproduce.
const HERO = "fractal-mono";

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
  env: {
    ...process.env,
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    ADMIN_EMAILS: ADMIN,
    NEXT_PUBLIC_SITE_URL: BASE,
  },
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

// Oculta el cartel de modo demo y apaga las animaciones de entrada para capturar en limpio.
const CLEAN = () => {
  const add = () => {
    const s = document.createElement("style");
    s.textContent =
      "[data-demo-banner]{display:none!important}.reveal{animation:none!important}.dot-cursor{display:none!important}";
    document.head.appendChild(s);
  };
  if (document.head) add();
  else document.addEventListener("DOMContentLoaded", add);
};

const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, name), ...opts });
const rect = (page, selector) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  });

async function login(page, email, next) {
  await page.goto(`${BASE}/ingresar?next=${next}`, { waitUntil: "networkidle" });
  await page.fill("input[name=email]", email);
  await page.click("button[type=submit]");
  await page.click("text=Modo demo: entrar sin email");
  await page.click('button:has-text("Entrar")');
  await page.waitForURL(`**${next}`);
}

async function buy(page, slug, email, provider) {
  const res = await page.request.post(`${BASE}/api/checkout`, { data: { slug, email, provider } });
  const { url } = await res.json();
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.click("text=Simular pago aprobado");
  await page.waitForURL("**/checkout/exito**");
}

await waitForServer();
const browser = await chromium.launch();
const meta = { phone: { width: 390, height: 844 } };

try {
  // ── Celular: la tienda como la ve un visitante ──────────────────────
  // El perfil de iPhone descuenta la barra del navegador; acá se usa la pantalla completa.
  const mobile = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "es-AR" });
  await mobile.addInitScript(CLEAN);
  const m = await mobile.newPage();

  await m.goto(BASE, { waitUntil: "networkidle" });
  // Recorre la página para que carguen las portadas de más abajo.
  for (let y = 0; y <= 3600; y += 600) {
    await m.evaluate((v) => scrollTo(0, v), y);
    await m.waitForTimeout(150);
  }
  await m.evaluate(() => scrollTo(0, 0));
  await m.waitForTimeout(400);
  const HOME_H = 3300;
  await shot(m, "home.png", { fullPage: true, clip: { x: 0, y: 0, width: 390, height: HOME_H } });
  meta.home = {
    height: HOME_H,
    tiles: await m.locator(".masonry a").evaluateAll((els) =>
      els.slice(0, 5).map((el) => {
        const r = el.getBoundingClientRect();
        return { y: r.y + scrollY, h: r.height };
      }),
    ),
  };

  await m.goto(`${BASE}/v/${HERO}`, { waitUntil: "networkidle" });
  await m.fill("input[name=email]", BUYER);
  await m.locator("input[name=email]").blur();
  await m.waitForTimeout(600);
  await shot(m, "detail.png", { fullPage: true });
  meta.detail = {
    height: await m.evaluate(() => document.documentElement.scrollHeight),
    email: await rect(m, "input[name=email]"),
    payFirst: await rect(m, "button.btn >> nth=0"),
    paySecond: await rect(m, "button.btn >> nth=1"),
  };

  // Entra con el link de acceso y compra tres videos.
  await login(m, BUYER, "/biblioteca");
  for (const [slug, provider] of [
    [HERO, "mercadopago"],
    ["humo-denso", "mercadopago"],
    ["aurora", "paypal"],
  ]) {
    await buy(m, slug, BUYER, provider);
  }
  await m.waitForTimeout(400);
  await shot(m, "exito.png");

  await m.goto(`${BASE}/biblioteca`, { waitUntil: "networkidle" });
  await m.waitForTimeout(800);
  await shot(m, "biblioteca.png", { fullPage: true, clip: { x: 0, y: 0, width: 390, height: 1500 } });
  meta.biblioteca = {
    height: 1500,
    tiles: await m.locator(".masonry a").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { y: r.y + scrollY, h: r.height };
      }),
    ),
  };

  await m.goto(`${BASE}/ver/${HERO}`, { waitUntil: "networkidle" });
  await m.waitForTimeout(800);
  await shot(m, "ver.png");

  // ── Más ventas, para que el panel no esté vacío ─────────────────────
  const desk = await browser.newContext({ viewport: { width: 760, height: 1000 }, deviceScaleFactor: 2, locale: "es-AR" });
  await desk.addInitScript(CLEAN);
  const d = await desk.newPage();
  const sales = [
    ["colonia", "lucas@estudio.com", "paypal"],
    ["halo-azul", "sofia@mail.com", "mercadopago"],
    ["trama-110", "marco@agencia.com", "mercadopago"],
    ["brasas", "julia@films.co", "paypal"],
    ["costa-profunda", "tomas@mail.com", "mercadopago"],
    ["espiral-gris", "emma@studio.io", "paypal"],
    ["aurora", "nico@mail.com", "mercadopago"],
  ];
  for (const [slug, email, provider] of sales) await buy(d, slug, email, provider);

  await login(d, ADMIN, "/admin/videos");
  await d.waitForTimeout(500);
  await shot(d, "admin-videos.png");
  await d.goto(`${BASE}/admin/ventas`, { waitUntil: "networkidle" });
  await d.waitForTimeout(500);
  await shot(d, "admin-ventas.png");

  writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
  console.log(`Capturas guardadas en ${path.relative(ROOT, OUT)}/`);
} finally {
  await browser.close();
  stop();
}
