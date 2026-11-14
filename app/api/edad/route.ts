import { NextResponse, type NextRequest } from "next/server";
import { AGE_COOKIE } from "@/lib/age";
import { safeNext } from "@/lib/session";

/** Confirma la mayoría de edad (cookie por un año) y vuelve a la página donde estaba. */
export async function POST(req: NextRequest) {
  let back = "/";
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.host === req.nextUrl.host) back = safeNext(u.pathname + u.search, "/");
    } catch {}
  }
  const res = NextResponse.redirect(new URL(back, req.nextUrl.origin), 303);
  res.cookies.set(AGE_COOKIE, "1", { path: "/", maxAge: 365 * 86400, sameSite: "lax", httpOnly: true });
  return res;
}
