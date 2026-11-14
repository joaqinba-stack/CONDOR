// Prepara el catálogo para la tienda a partir de lo extraído de ManyVids:
// aplica el precio mínimo y calcula el precio en pesos.
//
//   node importar/preparar.mjs [cotización]     (por defecto 1450 ARS por USD)
//
// Lee importar/out/manyvids.json → escribe importar/out/catalogo.json
// y agrega la columna "Precio tienda" a importar/out/manyvids.xlsx.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");

const OUT = path.join(import.meta.dirname, "out");
const MIN_USD = 5; // los videos pagos que cuestan menos pasan a este precio; los gratis siguen gratis
const RATE = Number(process.argv[2] ?? 1450);

const src = path.join(OUT, "manyvids.json");
if (!existsSync(src)) {
  console.error("Falta importar/out/manyvids.json: corré primero `npm run importar:manyvids`.");
  process.exit(1);
}
if (!(RATE > 0)) {
  console.error("La cotización tiene que ser un número mayor que 0.");
  process.exit(1);
}

/** Precio que se cobra en la tienda: gratis sigue gratis; si no, al menos MIN_USD. */
export function storePrice(v) {
  if (v.gratis || !v.precio_usd) return 0;
  return Math.max(MIN_USD, v.precio_usd);
}

const data = JSON.parse(readFileSync(src, "utf8"));

const productos = data.videos.map((v) => {
  const usd = storePrice(v);
  return {
    manyvids_id: v.manyvids_id,
    slug: v.slug,
    titulo: v.titulo,
    descripcion: v.descripcion,
    etiquetas: v.etiquetas,
    duracion_segundos: v.duracion_segundos,
    ancho: v.ancho,
    alto: v.alto,
    vertical: v.vertical,
    fecha_publicacion: v.fecha_publicacion,
    en_bundle: v.en_bundle,
    precio_manyvids_usd: v.precio_usd,
    precio_usd: usd,
    // Pesos redondeados a la centena.
    precio_ars: Math.round((usd * RATE) / 100) * 100,
    precio_cambiado: usd !== (v.precio_usd ?? 0),
    portada_url: v.captura_url,
    adelanto_url: v.adelanto_url,
  };
});

const catalogo = {
  fuente: data.fuente,
  preparado: new Date().toISOString(),
  regla_precio: `Pagos de menos de US$ ${MIN_USD} → US$ ${MIN_USD}. Gratis sigue gratis.`,
  cotizacion_ars: RATE,
  resumen: {
    productos: productos.length,
    precios_cambiados: productos.filter((p) => p.precio_cambiado).length,
    gratis: productos.filter((p) => p.precio_usd === 0).length,
  },
  bundle: data.bundle,
  productos,
};
writeFileSync(path.join(OUT, "catalogo.json"), JSON.stringify(catalogo, null, 2));

// Planilla: columna "Precio tienda" al lado del precio original.
const xlsx = path.join(OUT, "manyvids.xlsx");
if (existsSync(xlsx)) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsx);
  const ws = wb.getWorksheet("Videos");
  const header = ws.getRow(1).values;
  const idCol = header.indexOf("ID ManyVids");
  const priceCol = header.indexOf("Precio USD");
  let col = header.indexOf("Precio tienda USD");
  if (col === -1) {
    ws.spliceColumns(priceCol + 1, 0, []);
    col = priceCol + 1;
    ws.getCell(1, col).value = "Precio tienda USD";
    ws.getCell(1, col).font = { bold: true };
    ws.getColumn(col).width = 14;
  }
  const byId = new Map(productos.map((p) => [p.manyvids_id, p]));
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const p = byId.get(String(row.getCell(idCol).value));
    if (!p) return;
    const cell = row.getCell(col);
    cell.value = p.precio_usd;
    cell.numFmt = "0.00";
    cell.font = p.precio_cambiado ? { bold: true, color: { argb: "FFC00000" } } : {};
  });
  ws.autoFilter = undefined;
  await wb.xlsx.writeFile(xlsx);
}

console.log(
  `catalogo.json: ${productos.length} productos, ${catalogo.resumen.precios_cambiados} con precio cambiado, ${catalogo.resumen.gratis} gratis (cotización ${RATE}).`,
);
