import { NextResponse, type NextRequest } from "next/server";

/**
 * Aviso de mayoría de edad. Corre ANTES de armar cualquier página: si no se confirmó, se
 * muestra /edad en lugar de la página pedida (la URL no cambia). Así no se arma ni se envía
 * ninguna portada, adelanto ni texto del catálogo hasta confirmar.
 * Se apaga con AGE_GATE=off (contenido no explícito).
 */
export function proxy(req: NextRequest) {
  if ((process.env.AGE_GATE ?? "on").toLowerCase() === "off") return NextResponse.next();
  if (req.cookies.get("mayor_edad")?.value === "1") return NextResponse.next();
  return NextResponse.rewrite(new URL("/edad", req.url));
}

export const config = {
  // Todas las páginas, salvo la API, los archivos internos de Next, /edad y archivos con extensión.
  matcher: ["/((?!api/|_next/|edad$|.*\\.[a-zA-Z0-9]+$).*)"],
};
