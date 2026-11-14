# Video de presentación

Video vertical (1080×1920, ~58 s) con motion graphics para presentarle la tienda a la creadora
que la va a usar. Se genera por código: capturas reales del sitio en modo demo + una composición
animada que se renderiza cuadro a cuadro, con su video reproduciéndose dentro del celular.
Cambiás un texto y lo volvés a generar con un comando.

> Los archivos de `video/out/` usan el material de la clienta: no se versionan mientras el
> repositorio sea público (ver `.gitignore`).

Archivos finales en `video/out/`:

- `condor-presentacion-9x16.mp4` — con una base sonora simple (generada, sin derechos de terceros).
- `condor-presentacion-9x16-sin-audio.mp4` — sin audio, para ponerle tu propia música.

## Cambiar textos, marca o contacto

Todo el mensaje está en [`guion.json`](guion.json): nombre de la marca, línea de contacto del
cierre, los textos de cada escena y en qué segundo empieza cada una. Editás ese archivo y
volvés a renderizar.

## Regenerar

Hace falta Node.js, `ffmpeg` y Playwright con Chromium
(`npm i -D playwright && npx playwright install chromium` si no lo tenés).

```bash
npm run build           # compila la tienda (solo si cambió el sitio)
npm run video:capture   # saca las capturas del sitio en modo demo → video/captures/
npm run video:render    # arma el video → video/out/
```

`video:capture` solo hace falta la primera vez o cuando cambia el sitio o su contenido.

Para revisar un momento puntual sin renderizar todo:

```bash
node video/render.mjs --frames 12,30.5   # guarda esos segundos como imagen en video/.frames/
```

Para verlo animado en el navegador, serví la carpeta del proyecto (por ejemplo `npx serve .`)
y abrí `/video/composition/index.html?play`.

## Cómo está hecho

| Archivo | Qué hace |
|---|---|
| `guion.json` | Textos y tiempos |
| `capture.mjs` | Levanta la tienda en modo demo, compra, entra y guarda las capturas; prepara el video protagonista |
| `composition/index.html`, `styles.css` | Las escenas (1080×1920) |
| `composition/timeline.js` | La animación: una línea de tiempo de GSAP que se posiciona en cualquier segundo (y lleva los videos al cuadro exacto) |
| `render.mjs` | Recorre la línea de tiempo cuadro a cuadro (30 fps), y ffmpeg arma el MP4 y la base sonora |

Los textos importantes quedan dentro de la zona segura de los formatos verticales (libres los
250 px de arriba y los 350 px de abajo, donde las apps superponen su interfaz).

## Nota

Las capturas salen del catálogo del modo demo (`public/demo/`). Los títulos y precios que se ven
son los marcadores de `lib/store/fixtures.ts`, y la lista de ventas es la de la demo (compras
simuladas por `capture.mjs`), no ventas reales.
