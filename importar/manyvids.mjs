// Extrae SOLO EL TEXTO del catálogo público de videos de un perfil de ManyVids:
// títulos, descripciones, precios, duración, etiquetas, bundle y datos técnicos.
// No descarga imágenes ni videos (quedan bloqueados en el navegador); sus direcciones se
// guardan como texto para una etapa posterior. No guarda compradores ni comentarios.
//
//   npm run importar:manyvids                 → perfil por defecto
//   node importar/manyvids.mjs <id> <slug>    → otro perfil
//
// Salida en importar/out/: manyvids.json (todo) y manyvids.xlsx (planilla para revisar).
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");

const PROFILE_ID = process.argv[2] ?? "1004109845";
const PROFILE_SLUG = process.argv[3] ?? "lisa-bixio";
const STORE_URL = `https://www.manyvids.com/Profile/${PROFILE_ID}/${PROFILE_SLUG}/Store/Videos`;
const API = "https://api.manyvids.com";
const PAUSE_MS = 2000; // entre pedidos de detalle, para no cargar al sitio
const OUT = path.join(import.meta.dirname, "out");
const MEDIA = /\.(jpe?g|png|webp|gif|avif|mp4|mov|m3u8|ts|webm)(\?|$)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bool = (v) => v === true || v === "true" || v === "True";
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Texto plano: sin etiquetas HTML y con las entidades (&amp;, &#69917;…) decodificadas. */
function plain(s) {
  if (!s) return null;
  return String(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** "12:59" o "1:02:03" → segundos */
function seconds(d) {
  if (!d || typeof d !== "string") return null;
  return d.split(":").map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

try {
  const ctx = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  });
  await ctx.route(MEDIA, (r) => r.abort());
  const page = await ctx.newPage();

  console.log(`Abriendo ${STORE_URL}`);
  const res = await page.goto(STORE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!res || res.status() >= 400) throw new Error(`La tienda respondió ${res?.status()}`);
  await page.waitForTimeout(4000);

  /** GET a la API desde la página (mismas cookies y origen que el sitio), con reintentos. */
  const api = async (pathname) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url, { credentials: "include" });
          return { status: res.status, body: await res.text() };
        } catch (e) {
          return { status: 0, body: String(e) };
        }
      }, API + pathname);
      if (r.status === 200) return JSON.parse(r.body);
      console.warn(`  ${pathname} → ${r.status} (intento ${attempt})`);
      await sleep(PAUSE_MS * attempt * 2);
    }
    return null;
  };

  // Perfil (solo datos públicos de la creadora).
  // Esta respuesta viene sin el envoltorio { data } que usan las demás.
  const profileRes = await api(`/profile/profile/${PROFILE_ID}`);
  const profileRaw = profileRes?.data ?? profileRes ?? {};

  /** Lee una lista paginada de la tienda. */
  const readList = async (filter) => {
    const items = [];
    let total = 0;
    for (let pageNo = 1; ; pageNo++) {
      const r = await api(`/store/videos/${PROFILE_ID}?sort=newest${filter}&limit=70&page=${pageNo}`);
      if (!r) throw new Error("No se pudo leer la lista de videos");
      items.push(...r.data);
      total = r.pagination?.total ?? items.length;
      if (pageNo >= (r.pagination?.totalPages ?? 1)) break;
      await sleep(PAUSE_MS);
    }
    return { items, total };
  };
  // La lista general NO incluye los videos verticales ("Mobile"): se piden aparte y se suman.
  const general = await readList("");
  await sleep(PAUSE_MS);
  const mobile = await readList("&vertical=1");
  const verticalIds = new Set(mobile.items.map((v) => String(v.id)));
  const seen = new Set();
  const list = [...general.items, ...mobile.items].filter((v) => !seen.has(String(v.id)) && seen.add(String(v.id)));
  const total = general.total + mobile.total;
  console.log(`Lista: ${list.length} videos (${general.total} horizontales + ${mobile.total} verticales)`);

  const tagsRaw = (await api(`/store/videos/${PROFILE_ID}/tags`))?.data ?? [];
  const bundleRaw = (await api(`/store/videos/${PROFILE_ID}/bundle`))?.data?.vidBundle ?? null;

  // Detalle de cada video, de a uno.
  const details = new Map();
  const failed = [];
  for (const [i, v] of list.entries()) {
    await sleep(PAUSE_MS);
    const r = await api(`/store/video/${v.id}`);
    if (r?.data) details.set(String(v.id), r.data);
    else failed.push(String(v.id));
    process.stdout.write(`\r  detalle ${i + 1}/${list.length}`);
  }
  process.stdout.write("\n");

  const videos = list.map((item) => {
    const d = details.get(String(item.id)) ?? {};
    const price = d.price ?? item.price ?? {};
    const width = num(d.width);
    const height = num(d.height);
    return {
      manyvids_id: String(item.id),
      titulo: plain(d.title ?? item.title) ?? "",
      descripcion: plain(d.description ?? item.description) ?? "",
      url: `https://www.manyvids.com${d.url ?? `/Video/${item.id}/${item.slug}`}`,
      slug: item.slug ?? null,
      precio_usd: num(price.regular),
      gratis: bool(price.free),
      en_oferta: bool(price.onSale),
      precio_oferta_usd: bool(price.onSale) ? num(price.discountedPrice) : null,
      duracion: d.videoDuration ?? item.duration ?? null,
      duracion_segundos: seconds(d.videoDuration ?? item.duration),
      fecha_publicacion: d.launchDate ?? item.launchDate ?? null,
      etiquetas: (d.tagList ?? []).map((t) => t.label),
      en_bundle: bool(d.isInBundle),
      exclusivo_bundle: bool(d.isExclusiveForBundle),
      exclusivo: bool(d.isExclusive),
      solo_streaming: bool(d.isStreamOnly),
      pedido_a_medida: bool(d.isCustomOrder),
      vertical: verticalIds.has(String(item.id)) || (width && height ? height > width : false),
      ancho: width,
      alto: height,
      resolucion: d.resolution ?? null,
      formato: d.extension ?? null,
      peso: d.size ?? null,
      intensidad: d.intensity ?? null,
      vistas: num(d.viewsRaw ?? item.views),
      likes: num(d.likesRaw ?? item.likes),
      cantidad_comentarios: num(d.comments),
      estado: d.status ?? null,
      // Direcciones de medios, SOLO como texto (no se descargaron).
      miniatura_url: d.thumbnail ?? null,
      captura_url: d.screenshot ?? null,
      adelanto_url: d.teaser?.filepath ?? null,
      detalle_completo: details.has(String(item.id)),
    };
  });

  // Etiquetas: cuántos videos usan cada una (calculado sobre lo extraído) y cuáles.
  const tagIndex = new Map();
  for (const v of videos) for (const t of v.etiquetas) tagIndex.set(t, [...(tagIndex.get(t) ?? []), v.manyvids_id]);
  const tags = tagsRaw
    .map((t) => ({ etiqueta: t.label, manyvids_tag_id: String(t.id), videos: tagIndex.get(t.label) ?? [] }))
    .sort((a, b) => b.videos.length - a.videos.length || a.etiqueta.localeCompare(b.etiqueta));

  const bundle = bundleRaw && {
    nombre: "Vid Bundle (1 mes)",
    activo: bool(bundleRaw.active),
    pausado: bool(bundleRaw.paused),
    precio_usd: num(bundleRaw.price),
    videos_incluidos_segun_manyvids: num(bundleRaw.includedVids),
    precio_promedio_por_video_usd: num(bundleRaw.averageVideoPrice),
    videos_extraidos_en_bundle: videos.filter((v) => v.en_bundle).map((v) => v.manyvids_id),
    // lastPurchases (nombres de compradores) se descarta a propósito.
  };

  // Solo lo que el perfil muestra públicamente.
  const profile = {
    manyvids_id: PROFILE_ID,
    nombre: profileRaw.displayName ?? null,
    usuario: profileRaw.username ?? null,
    handle: profileRaw.urlHandle ?? null,
    bio: plain(profileRaw.bio),
    descripcion: plain(profileRaw.description),
    profesion: profileRaw.profession ?? null,
    orientacion: profileRaw.orientation ?? null,
    redes: Object.fromEntries(
      Object.entries(profileRaw).filter(([k, v]) => k.startsWith("socLink") && v).map(([k, v]) => [k.replace("socLink", "").toLowerCase(), v]),
    ),
    url: STORE_URL,
  };

  const result = {
    fuente: STORE_URL,
    extraido: new Date().toISOString(),
    nota: "Solo texto. Precios en USD tal como figuran en ManyVids.",
    perfil: profile,
    resumen: {
      videos_extraidos: videos.length,
      total_segun_api: total,
      horizontales: general.total,
      con_detalle_completo: videos.filter((v) => v.detalle_completo).length,
      sin_detalle: failed,
      etiquetas_distintas: tags.length,
      en_bundle: videos.filter((v) => v.en_bundle).length,
      verticales: videos.filter((v) => v.vertical).length,
    },
    bundle,
    etiquetas: tags,
    videos,
  };
  writeFileSync(path.join(OUT, "manyvids.json"), JSON.stringify(result, null, 2));

  // ── Planilla ──────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const header = (ws) => {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const wv = wb.addWorksheet("Videos");
  wv.columns = [
    { header: "ID ManyVids", key: "manyvids_id", width: 12 },
    { header: "Título", key: "titulo", width: 42 },
    { header: "Descripción", key: "descripcion", width: 70 },
    { header: "Precio USD", key: "precio_usd", width: 11 },
    { header: "Gratis", key: "gratis", width: 8 },
    { header: "En oferta", key: "en_oferta", width: 9 },
    { header: "Precio oferta USD", key: "precio_oferta_usd", width: 12 },
    { header: "Duración", key: "duracion", width: 10 },
    { header: "Publicado", key: "fecha", width: 12 },
    { header: "Etiquetas", key: "etiquetas", width: 50 },
    { header: "En bundle", key: "en_bundle", width: 10 },
    { header: "Vertical", key: "vertical", width: 9 },
    { header: "Resolución", key: "resolucion", width: 11 },
    { header: "Ancho", key: "ancho", width: 8 },
    { header: "Alto", key: "alto", width: 8 },
    { header: "Formato", key: "formato", width: 9 },
    { header: "Peso", key: "peso", width: 10 },
    { header: "Exclusivo", key: "exclusivo", width: 10 },
    { header: "Solo streaming", key: "solo_streaming", width: 13 },
    { header: "Vistas", key: "vistas", width: 9 },
    { header: "Likes", key: "likes", width: 8 },
    { header: "URL", key: "url", width: 60 },
  ];
  const yn = (b) => (b === null ? "" : b ? "Sí" : "No");
  for (const v of videos) {
    wv.addRow({
      ...v,
      gratis: yn(v.gratis),
      en_oferta: yn(v.en_oferta),
      en_bundle: yn(v.en_bundle),
      vertical: yn(v.vertical),
      exclusivo: yn(v.exclusivo),
      solo_streaming: yn(v.solo_streaming),
      fecha: v.fecha_publicacion ? v.fecha_publicacion.slice(0, 10) : "",
      etiquetas: v.etiquetas.join(", "),
    });
  }
  wv.getColumn("descripcion").alignment = { wrapText: true, vertical: "top" };
  wv.getColumn("precio_usd").numFmt = "0.00";
  header(wv);
  wv.autoFilter = { from: "A1", to: "V1" };

  const wt = wb.addWorksheet("Etiquetas");
  wt.columns = [
    { header: "Etiqueta", key: "etiqueta", width: 28 },
    { header: "Cantidad de videos", key: "n", width: 18 },
    { header: "Videos (títulos)", key: "titulos", width: 100 },
  ];
  const titleById = new Map(videos.map((v) => [v.manyvids_id, v.titulo]));
  for (const t of tags) {
    wt.addRow({ etiqueta: t.etiqueta, n: t.videos.length, titulos: t.videos.map((id) => titleById.get(id)).join(" · ") });
  }
  header(wt);

  const wbund = wb.addWorksheet("Bundle");
  wbund.columns = [
    { header: "Dato", key: "k", width: 36 },
    { header: "Valor", key: "v", width: 60 },
  ];
  if (bundle) {
    wbund.addRows([
      { k: "Nombre", v: bundle.nombre },
      { k: "Activo", v: yn(bundle.activo) },
      { k: "Precio USD", v: bundle.precio_usd },
      { k: "Videos incluidos (según ManyVids)", v: bundle.videos_incluidos_segun_manyvids },
      { k: "Videos extraídos que están en el bundle", v: bundle.videos_extraidos_en_bundle.length },
    ]);
  }
  header(wbund);

  const wp = wb.addWorksheet("Perfil");
  wp.columns = [
    { header: "Dato", key: "k", width: 18 },
    { header: "Valor", key: "v", width: 90 },
  ];
  wp.addRows([
    { k: "Nombre", v: profile.nombre },
    { k: "Usuario", v: profile.usuario },
    { k: "Bio", v: profile.bio },
    { k: "Descripción", v: profile.descripcion },
    { k: "Profesión", v: profile.profesion },
    ...Object.entries(profile.redes).map(([k, v]) => ({ k: `Red: ${k}`, v })),
    { k: "Tienda", v: profile.url },
  ]);
  wp.getColumn("v").alignment = { wrapText: true, vertical: "top" };
  header(wp);

  await wb.xlsx.writeFile(path.join(OUT, "manyvids.xlsx"));

  console.log(`Listo: ${videos.length} videos, ${tags.length} etiquetas → importar/out/manyvids.json y manyvids.xlsx`);
  if (failed.length) console.log(`Sin detalle: ${failed.join(", ")}`);
} finally {
  await browser.close();
}
