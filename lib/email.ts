import { env } from "./env";
import { dict, videoTitle, type Locale } from "./i18n";
import { createLoginLink } from "./session";
import type { Order, Video } from "./types";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, cta: { label: string; url: string }, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#e5e5e5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;text-align:left">
<tr><td style="font-size:14px;color:#fff;padding-bottom:32px">${esc(env.siteName)}</td></tr>
<tr><td style="font-size:20px;color:#fff;padding-bottom:12px">${esc(title)}</td></tr>
<tr><td style="font-size:14px;line-height:22px;color:#a3a3a3;padding-bottom:28px">${bodyHtml}</td></tr>
<tr><td style="padding-bottom:28px"><a href="${esc(cta.url)}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-size:14px;padding:12px 20px;border-radius:999px">${esc(cta.label)}</a></td></tr>
<tr><td style="font-size:12px;line-height:18px;color:#737373">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Envía por Resend. Sin RESEND_API_KEY (desarrollo/demo) solo lo muestra en la consola. */
export async function sendEmail(mail: OutgoingEmail): Promise<void> {
  if (!env.resendKey) {
    console.log(`\n[email no enviado: falta RESEND_API_KEY]\nPara: ${mail.to}\nAsunto: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, ...mail }),
  });
  if (!res.ok) throw new Error(`Resend: no se pudo enviar el email (${res.status})`);
}

export async function sendPurchaseEmail(order: Order, video: Video): Promise<void> {
  const locale = (order.locale === "en" ? "en" : "es") as Locale;
  const t = dict(locale);
  const title = videoTitle(video, locale);
  const url = await createLoginLink(order.email, `/ver/${video.slug}`, 7 * 24 * 60); // sirve para videos y fotos
  const loginUrl = `${env.siteUrl}/ingresar`;
  await sendEmail({
    to: order.email,
    subject: `${t.email_subject}: ${title}`,
    html: layout(
      t.email_hello,
      `${esc(t.email_body)} <strong style="color:#fff">${esc(title)}</strong>.`,
      { label: t.email_cta, url },
      `${esc(t.email_expire)} <a href="${esc(loginUrl)}" style="color:#a3a3a3">${esc(loginUrl)}</a>.`,
    ),
    text: `${t.email_hello}\n\n${t.email_body} ${title}.\n\n${t.email_cta}: ${url}\n\n${t.email_expire} ${loginUrl}`,
  });
}

export async function sendLoginEmail(email: string, next: string, locale: Locale): Promise<void> {
  const t = dict(locale);
  const url = await createLoginLink(email, next, 30);
  await sendEmail({
    to: email,
    subject: `${t.email_login_subject} — ${env.siteName}`,
    html: layout(t.email_login_subject, esc(t.email_login_body), { label: t.email_login_cta, url }, esc(t.email_ignore)),
    text: `${t.email_login_body}\n\n${url}\n\n${t.email_ignore}`,
  });
}
