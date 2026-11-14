import { cookies } from "next/headers";

export const AGE_COOKIE = "mayor_edad";

/** El aviso 18+ está activo salvo que se apague con AGE_GATE=off (contenido no explícito). */
export const ageGateEnabled = () => (process.env.AGE_GATE ?? "on").toLowerCase() !== "off";

export async function ageConfirmed(): Promise<boolean> {
  return (await cookies()).get(AGE_COOKIE)?.value === "1";
}
