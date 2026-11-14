/**
 * Lectura centralizada de variables de entorno.
 * Si falta Supabase la app corre en "modo demo": catálogo de ejemplo en memoria,
 * sin cobros reales. Sirve para ver el diseño antes de configurar las cuentas.
 */
const e = (k: string) => {
  const v = process.env[k];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

export const env = {
  get siteName() {
    return e("NEXT_PUBLIC_SITE_NAME") ?? "Condor";
  },
  get siteUrl() {
    return (e("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get contactEmail() {
    return e("CONTACT_EMAIL");
  },
  get adminEmails() {
    return (e("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  },
  get sessionSecret() {
    const s = e("SESSION_SECRET");
    if (s) return s;
    if (env.isDemo) return "demo-secret-no-usar-en-produccion";
    throw new Error("Falta SESSION_SECRET");
  },

  get supabaseUrl() {
    return e("SUPABASE_URL");
  },
  get supabaseServiceKey() {
    return e("SUPABASE_SERVICE_ROLE_KEY");
  },
  get isDemo() {
    return !e("SUPABASE_URL") || !e("SUPABASE_SERVICE_ROLE_KEY");
  },

  get mpAccessToken() {
    return e("MP_ACCESS_TOKEN");
  },
  get mpWebhookSecret() {
    return e("MP_WEBHOOK_SECRET");
  },

  get paypalClientId() {
    return e("PAYPAL_CLIENT_ID");
  },
  get paypalClientSecret() {
    return e("PAYPAL_CLIENT_SECRET");
  },
  get paypalWebhookId() {
    return e("PAYPAL_WEBHOOK_ID");
  },
  get paypalBase() {
    return e("PAYPAL_ENV") === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  },

  /** Biblioteca protegida (videos completos). */
  get bunnyLibraryId() {
    return e("BUNNY_LIBRARY_ID");
  },
  get bunnyApiKey() {
    return e("BUNNY_API_KEY");
  },
  get bunnyReadOnlyKey() {
    return e("BUNNY_READONLY_API_KEY");
  },
  get bunnyTokenKey() {
    return e("BUNNY_TOKEN_AUTH_KEY");
  },
  /** Biblioteca pública (tráilers). */
  get bunnyTrailerLibraryId() {
    return e("BUNNY_TRAILER_LIBRARY_ID");
  },
  get bunnyTrailerApiKey() {
    return e("BUNNY_TRAILER_API_KEY");
  },
  get bunnyTrailerReadOnlyKey() {
    return e("BUNNY_TRAILER_READONLY_API_KEY");
  },
  get bunnyTrailerCdnHost() {
    return e("BUNNY_TRAILER_CDN_HOST");
  },

  get resendKey() {
    return e("RESEND_API_KEY");
  },
  get emailFrom() {
    return e("EMAIL_FROM") ?? `${env.siteName} <onboarding@resend.dev>`;
  },
};

export const mpEnabled = () => !!env.mpAccessToken;
export const paypalEnabled = () => !!env.paypalClientId && !!env.paypalClientSecret;
export const bunnyEnabled = () => !!env.bunnyLibraryId && !!env.bunnyApiKey && !!env.bunnyTokenKey;
export const bunnyTrailersEnabled = () =>
  !!env.bunnyTrailerLibraryId && !!env.bunnyTrailerApiKey && !!env.bunnyTrailerCdnHost;
