import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/session";

/** Cambia el idioma (cookie) y vuelve a la página anterior. */
export async function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l") === "en" ? "en" : "es";
  let back = "/";
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.host === req.nextUrl.host) back = safeNext(u.pathname + u.search, "/");
    } catch {}
  }
  const res = NextResponse.redirect(new URL(back, req.nextUrl.origin), 303);
  res.cookies.set("lang", l, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return res;
}
