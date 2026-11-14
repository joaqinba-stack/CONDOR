import { Cursor } from "./Cursor";
import { Header } from "./Header";

/** Marco común de las páginas de la tienda (no del admin). */
export function Shell({ children, variant }: { children: React.ReactNode; variant?: "full" | "compact" }) {
  return (
    <>
      <Cursor />
      <Header variant={variant} />
      {children}
    </>
  );
}
