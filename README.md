# Condor — tienda personal de contenido

Sitio para que una creadora venda su contenido (videos y fotos) a sus seguidores, con pago único.
El comprador paga con **Mercado Pago** (pesos) o **PayPal** (dólares), recibe un email con un link
de acceso y ve lo que compró online desde su biblioteca. Todo se carga desde un panel de
administración, sin tocar código.

## Cómo funciona

1. **Cargás un producto** en `/admin`: un video, o una o varias fotos. Título, descripción,
   precio en USD y en ARS, los archivos y una portada.
2. **Los videos se guardan en Bunny Stream**, que los convierte a todas las calidades y los sirve
   rápido en todo el mundo. **Las fotos se guardan en un bucket privado** de Supabase. En los
   dos casos el contenido solo se ve con un link firmado que vence.
3. **El cliente** elige un producto, escribe su email y paga. El sitio le sugiere Mercado Pago si
   está en Argentina y PayPal si está en otro país (siempre puede elegir el otro).
4. **Cuando el pago se acredita**, el sistema le habilita ese producto a ese email y le manda un
   correo con un link para entrar (sin contraseña). En “Mi biblioteca” ve todo lo que compró.
5. Si hay un **reembolso o contracargo**, el acceso se quita solo.

## Probarlo en tu computadora (modo demo)

Hace falta [Node.js](https://nodejs.org) 20 o más nuevo.

```bash
npm install
ADMIN_EMAILS=admin@demo.local npm run dev
```

Abrí <http://localhost:3000>. Sin ninguna cuenta configurada el sitio corre en **modo demo**: muestra
un catálogo de ejemplo, el pago se simula con un botón y el link de acceso aparece en pantalla
en vez de llegar por email.

> El catálogo de ejemplo usa archivos de `public/demo/` (definidos en `lib/store/fixtures.ts`).
> Ese material **no se versiona mientras el repositorio sea público** (ver `.gitignore`): en un
> clon nuevo hay que copiarlo a mano, o las portadas del modo demo aparecen vacías.
 Para ver el panel, ingresá con `admin@demo.local` y entrá a `/admin`.
En modo demo los datos se pierden al reiniciar.

## Puesta en marcha (una sola vez)

Todas las claves se cargan como **variables de entorno** (la lista completa está en
[`.env.example`](.env.example)). Nunca van en el código ni se suben al repositorio.
En `/admin/ajustes` hay una lista que muestra qué está configurado y qué falta.

### 1. Supabase (base de datos)

1. Crear un proyecto en <https://supabase.com>.
2. **SQL Editor** → pegar y ejecutar, en orden,
   [`0001_init.sql`](supabase/migrations/0001_init.sql) y
   [`0002_fotos.sql`](supabase/migrations/0002_fotos.sql). Crean las tablas y dos buckets de
   Storage: `covers` (público, portadas) y `fotos` (privado, las fotos que se venden).
3. **Project Settings → API**: copiar la *Project URL* a `SUPABASE_URL` y la clave *service_role* a
   `SUPABASE_SERVICE_ROLE_KEY`. Esa clave es secreta: da acceso total a la base.

### 2. Bunny Stream (los videos)

Crear una cuenta en <https://bunny.net> y, en **Stream**, dos bibliotecas:

**a) Videos completos (protegida)** — por ejemplo `condor-completos`
- **Security**: activar *Embed view token authentication* y copiar la *Token authentication key*
  a `BUNNY_TOKEN_AUTH_KEY`. Activar *Block direct url file access* y, en *Allowed domains*,
  poner tu dominio.
- **API**: copiar *Video Library ID* → `BUNNY_LIBRARY_ID`, *API Key* → `BUNNY_API_KEY`,
  *Read-Only API Key* → `BUNNY_READONLY_API_KEY`.
- **Webhooks**: `https://tudominio.com/api/webhooks/bunny`

**b) Tráilers (pública)** — por ejemplo `condor-trailers`
- **Encoding**: activar *MP4 fallback* **antes** de subir el primer tráiler (solo se genera al
  procesar; los subidos antes de activarlo no lo tienen).
- **API**: *Video Library ID* → `BUNNY_TRAILER_LIBRARY_ID`, *API Key* → `BUNNY_TRAILER_API_KEY`,
  *Read-Only API Key* → `BUNNY_TRAILER_READONLY_API_KEY`, *CDN Hostname* → `BUNNY_TRAILER_CDN_HOST`.
- **Webhooks**: la misma URL que arriba.

### 3. Mercado Pago (cobros en pesos)

1. En <https://www.mercadopago.com.ar/developers> → **Tus integraciones** → crear una aplicación
   de tipo *Checkout Pro*.
2. **Credenciales de producción** → copiar el *Access Token* a `MP_ACCESS_TOKEN`.
   (Para probar sin plata real, usá primero las credenciales de prueba y usuarios de prueba.)
3. **Webhooks** → URL `https://tudominio.com/api/webhooks/mercadopago`, evento **Pagos**.
   Copiar la *clave secreta* a `MP_WEBHOOK_SECRET`.

### 4. PayPal (cobros en dólares)

1. Hace falta una cuenta PayPal **Business**.
2. En <https://developer.paypal.com> → **Apps & Credentials** → *Create App*.
   Copiar *Client ID* → `PAYPAL_CLIENT_ID` y *Secret* → `PAYPAL_CLIENT_SECRET`.
3. En la app → **Webhooks** → *Add Webhook*: URL `https://tudominio.com/api/webhooks/paypal`,
   eventos `Payment capture completed`, `denied`, `refunded` y `reversed`.
   Copiar el *Webhook ID* a `PAYPAL_WEBHOOK_ID`.
4. Probar primero en **Sandbox** (`PAYPAL_ENV=sandbox`). Para cobrar de verdad, repetir los pasos
   2 y 3 en la pestaña **Live** y poner `PAYPAL_ENV=live`.

> PayPal no permite pagos entre dos cuentas argentinas; por eso los compradores de Argentina
> pagan con Mercado Pago. Los dólares cobrados quedan en tu saldo de PayPal.

### 5. Resend (emails)

1. Crear una cuenta en <https://resend.com> y **verificar tu dominio** (te da unos registros DNS).
2. Crear una *API Key* → `RESEND_API_KEY`.
3. `EMAIL_FROM` con una dirección de ese dominio, por ejemplo `Condor <hola@tudominio.com>`.

### 6. Publicar el sitio (Vercel)

1. En <https://vercel.com> → *Add New Project* → importar este repositorio.
2. Cargar todas las variables de `.env.example` en **Settings → Environment Variables**.
   No olvidar `NEXT_PUBLIC_SITE_URL` (tu dominio con `https://`), `ADMIN_EMAILS` y `SESSION_SECRET`.
3. Conectar tu dominio en **Settings → Domains** y volver a desplegar.

El plan gratuito de Vercel es para uso no comercial; para una tienda corresponde el plan Pro.

## Uso diario

- **Cargar un video:** `/admin` → *Nuevo producto* → *Un video*. El archivo se sube directo a
  Bunny con barra de progreso (si se corta la conexión, continúa). Queda en “Procesando…” y se
  publica solo al terminar. Si tarda, el botón *Actualizar estado* consulta a Bunny.
- **Cargar fotos:** *Nuevo producto* → *Fotos*. Se eligen una o varias; suben directo al bucket
  privado. La portada es pública (es lo que se ve antes de comprar): se puede subir una, o dejar
  que se genere **difuminada** a partir de la primera foto para no regalar la imagen.
- **Precios:** cada video tiene un precio en USD (PayPal) y otro en ARS (Mercado Pago). El de pesos
  se sugiere con la cotización de `/admin/ajustes`, pero lo podés escribir a mano. Cambiar la
  cotización no modifica los videos ya cargados.
- **Ventas:** `/admin/ventas` muestra todas las órdenes y permite **dar acceso manual** a un email
  (regalos, reclamos).
- **Reembolsos:** se hacen desde Mercado Pago o PayPal; el sitio se entera solo y quita el acceso.
- **Ocultar / borrar:** un video con ventas no se borra, solo se oculta, para que quienes lo
  compraron lo sigan viendo.

## Seguridad

- El acceso se decide **en el servidor** en cada visita (`lib/access.ts`). Sin sesión y sin
  compra registrada nunca se genera la URL del video ni las de las fotos.
- El precio se toma de la base de datos al crear la orden; el navegador no puede cambiarlo.
- Un pago solo cuenta cuando lo confirma el medio de pago: se valida la firma del aviso y además
  se consulta el pago a su API. La página de “gracias” por sí sola no habilita nada.
- Avisos repetidos no duplican accesos ni emails (`lib/fulfill.ts`).
- Los links de acceso sirven una sola vez y vencen; en la base se guarda solo su hash.
- La base tiene RLS activado sin políticas: solo el servidor puede leerla.

Ver online **dificulta** la copia pero no la impide del todo: alguien puede grabar la pantalla o
sacar una captura. Para videos muy sensibles, Bunny ofrece DRM (MediaCage) como extra.

## Medios de pago y tipo de contenido

Antes de salir a vender conviene confirmar con cada medio de pago que acepta el contenido:

- **PayPal** prohíbe expresamente vender contenido sexual entregado en forma digital (imágenes,
  videos, suscripciones) y puede cerrar la cuenta reteniendo el saldo
  ([política](https://www.paypal.com/us/cshelp/article/HELP384)).
- **Mercado Pago** puede suspender cuentas por actividades que considera prohibidas; conviene
  revisar sus términos vigentes.

Con contenido sugerente sin desnudos el riesgo es moderado, pero existe. Si en algún momento se
vende contenido explícito hay que reemplazar estos medios por procesadores que lo acepten.

## Material para mostrar la plataforma

- **Recorrido del comprador** (`recorrido/`): un paquete de imágenes con cada paso de una compra,
  tal como lo ve el cliente (entrar, elegir, pagar, recibir el email, ver el video o las fotos).
  `npm run build && npm run recorrido` genera en `recorrido/out/` una lámina por paso, las
  capturas solas, una hoja resumen y un PDF. Los textos de cada paso están en
  `recorrido/pasos.json`.
- **Video de presentación** (`video/`): ver [`video/README.md`](video/README.md).

En modo demo, la página de “gracias por tu compra” incluye un link para ver el email que
recibiría el comprador, así se puede recorrer la compra completa sin configurar nada.

## Desarrollo

```bash
npm run dev        # servidor local
npm test           # tests (firmas, entrega idempotente, sesiones)
npm run lint
npm run typecheck
npm run build
```

| Carpeta | Qué hay |
|---|---|
| `app/` | Páginas (tienda, biblioteca, admin) y rutas de API (checkout, webhooks) |
| `components/` | Grilla, tile, panel de compra, reproductor, formulario de carga |
| `lib/payments/` | Mercado Pago y PayPal |
| `lib/fulfill.ts` | Único lugar donde un pago confirmado se convierte en acceso |
| `lib/bunny.ts` | Videos: subida firmada y URL de reproducción firmada |
| `lib/photos.ts` | Fotos: subida firmada al bucket privado y URLs firmadas para verlas |
| `lib/access.ts` | Decide quién puede ver cada producto |
| `lib/store/` | Acceso a datos: Supabase (producción) y memoria (demo y tests) |
| `supabase/migrations/` | Esquema de la base |

## Fuera de alcance (por ahora)

Suscripciones, cupones, descarga de archivos, productos que mezclen video y fotos, y
facturación electrónica (ARCA).
