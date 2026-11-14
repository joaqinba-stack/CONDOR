import { cookies, headers } from "next/headers";
import type { Video } from "./types";

export type Locale = "es" | "en";

const es = {
  nav_videos: "Videos",
  nav_about: "Sobre",
  nav_contact: "Contacto",
  nav_library: "Mi biblioteca",
  nav_login: "Ingresar",
  nav_logout: "Salir",
  intro:
    "Material de video para creadores: texturas, fondos, transiciones y loops listos para usar en tus proyectos.",
  intro_2: "Comprás una vez y lo ves cuando quieras desde tu biblioteca.",
  empty: "Todavía no hay videos publicados.",
  buy: "Comprar",
  buy_with_mp: "Pagar con Mercado Pago",
  buy_with_paypal: "Pagar con PayPal o tarjeta",
  pay_ars: "En pesos argentinos",
  pay_usd: "En dólares, desde cualquier país",
  your_email: "Tu email",
  email_hint: "Ahí te enviamos el acceso al video.",
  owned: "Ya es tuyo",
  watch_now: "Ver ahora",
  duration: "Duración",
  redirecting: "Redirigiendo al pago…",
  invalid_email: "Revisá el email.",
  generic_error: "Algo salió mal. Probá de nuevo.",
  provider_off: "Este medio de pago todavía no está disponible.",
  secure_note: "Pago seguro. El acceso se habilita apenas se acredita.",
  library_title: "Mi biblioteca",
  library_empty: "Todavía no compraste ningún video.",
  library_browse: "Ver el catálogo",
  login_title: "Ingresar",
  login_text: "Escribí tu email y te mandamos un link para entrar. No hace falta contraseña.",
  login_send: "Enviarme el link",
  login_sent: "Listo. Si el email es correcto, en unos segundos te llega el link de acceso.",
  login_wait: "Ya te enviamos un link hace instantes. Revisá tu correo (y el spam).",
  confirm_title: "Confirmá para entrar",
  confirm_button: "Entrar",
  confirm_invalid: "El link venció o ya fue usado. Pedí uno nuevo.",
  ok_title: "¡Gracias por tu compra!",
  ok_paid: "El pago se acreditó. Te enviamos el acceso a",
  ok_pending_title: "Estamos confirmando tu pago",
  ok_pending: "Puede tardar unos minutos. Apenas se acredite te llega un email con el acceso a",
  ok_failed_title: "El pago no se completó",
  ok_failed: "No se realizó ningún cobro. Podés intentar de nuevo.",
  ok_refunded: "Esta compra fue reembolsada.",
  ok_check_spam: "Si no lo ves, revisá la carpeta de spam.",
  try_again: "Volver al video",
  not_found: "No encontramos esa página.",
  back_home: "Volver al inicio",
  no_access: "No tenés acceso a este video.",
  processing: "El video todavía se está procesando. Volvé en unos minutos.",
  about_title: "Sobre",
  about_text:
    "Somos un estudio que produce material de video para creadores, editores y diseñadores. Cada pieza se filma o genera en alta calidad y se entrega lista para usar.",
  about_how: "Cómo funciona",
  about_how_1: "Elegís un video y pagás con Mercado Pago (pesos) o PayPal (dólares).",
  about_how_2: "Te llega un email con un link de acceso, sin contraseñas.",
  about_how_3: "Lo ves cuando quieras desde tu biblioteca.",
  demo_banner: "Modo demo: catálogo de ejemplo, sin cobros reales.",
  email_subject: "Tu video está listo",
  email_hello: "¡Gracias por tu compra!",
  email_body: "Ya podés ver",
  email_cta: "Ver mi video",
  email_expire:
    "Este link vence en 7 días y sirve una sola vez. Después podés entrar cuando quieras desde",
  email_login_subject: "Tu link de acceso",
  email_login_body: "Usá este link para entrar. Vence en 30 minutos y sirve una sola vez.",
  email_login_cta: "Entrar",
  email_ignore: "Si no pediste este email, podés ignorarlo.",
};

const en: typeof es = {
  nav_videos: "Videos",
  nav_about: "About",
  nav_contact: "Contact",
  nav_library: "My library",
  nav_login: "Sign in",
  nav_logout: "Sign out",
  intro:
    "Video material for creators: textures, backgrounds, transitions and loops ready to drop into your projects.",
  intro_2: "Buy once and watch whenever you want from your library.",
  empty: "No videos published yet.",
  buy: "Buy",
  buy_with_mp: "Pay with Mercado Pago",
  buy_with_paypal: "Pay with PayPal or card",
  pay_ars: "In Argentine pesos",
  pay_usd: "In US dollars, from any country",
  your_email: "Your email",
  email_hint: "We'll send your access to the video there.",
  owned: "You own this",
  watch_now: "Watch now",
  duration: "Length",
  redirecting: "Redirecting to payment…",
  invalid_email: "Please check the email address.",
  generic_error: "Something went wrong. Please try again.",
  provider_off: "This payment method isn't available yet.",
  secure_note: "Secure payment. Access is enabled as soon as it clears.",
  library_title: "My library",
  library_empty: "You haven't bought any videos yet.",
  library_browse: "Browse the catalog",
  login_title: "Sign in",
  login_text: "Enter your email and we'll send you a sign-in link. No password needed.",
  login_send: "Send me the link",
  login_sent: "Done. If the email is correct, the sign-in link will arrive in a few seconds.",
  login_wait: "We just sent you a link. Check your inbox (and spam).",
  confirm_title: "Confirm to sign in",
  confirm_button: "Sign in",
  confirm_invalid: "This link has expired or was already used. Request a new one.",
  ok_title: "Thanks for your purchase!",
  ok_paid: "Your payment cleared. We sent your access to",
  ok_pending_title: "We're confirming your payment",
  ok_pending: "This can take a few minutes. As soon as it clears you'll get an email with access at",
  ok_failed_title: "The payment wasn't completed",
  ok_failed: "You were not charged. You can try again.",
  ok_refunded: "This purchase was refunded.",
  ok_check_spam: "If you don't see it, check your spam folder.",
  try_again: "Back to the video",
  not_found: "We couldn't find that page.",
  back_home: "Back to home",
  no_access: "You don't have access to this video.",
  processing: "This video is still processing. Come back in a few minutes.",
  about_title: "About",
  about_text:
    "We're a studio producing video material for creators, editors and designers. Every piece is shot or generated in high quality and delivered ready to use.",
  about_how: "How it works",
  about_how_1: "Pick a video and pay with Mercado Pago (pesos) or PayPal (US dollars).",
  about_how_2: "You get an email with a sign-in link, no passwords.",
  about_how_3: "Watch it whenever you want from your library.",
  demo_banner: "Demo mode: sample catalog, no real charges.",
  email_subject: "Your video is ready",
  email_hello: "Thanks for your purchase!",
  email_body: "You can now watch",
  email_cta: "Watch my video",
  email_expire: "This link expires in 7 days and works once. After that you can sign in any time at",
  email_login_subject: "Your sign-in link",
  email_login_body: "Use this link to sign in. It expires in 30 minutes and works once.",
  email_login_cta: "Sign in",
  email_ignore: "If you didn't request this email, you can ignore it.",
};

export type Dict = typeof es;
export const dicts: Record<Locale, Dict> = { es, en };
export const dict = (locale: string): Dict => (locale === "en" ? en : es);

/** Español por defecto; inglés si el navegador no está en español (o si se eligió a mano). */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const chosen = jar.get("lang")?.value;
  if (chosen === "es" || chosen === "en") return chosen;
  const accept = (await headers()).get("accept-language");
  if (!accept) return "es";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("es") ? "es" : "en";
}

export const videoTitle = (v: Video, locale: Locale) => (locale === "en" && v.title_en) || v.title;
export const videoDescription = (v: Video, locale: Locale) =>
  (locale === "en" && v.description_en) || v.description;
