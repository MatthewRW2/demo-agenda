import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";

interface Props {
  slug: string;
  nombre: string;
  logo?: string;
  /** Lo que va al extremo derecho (por ejemplo "← Atrás"). */
  children?: ReactNode;
}

/** Franja de marca de las pantallas internas (reservar, tu cita): logo y nombre llevan al inicio. */
export function CabeceraSimple({ slug, nombre, logo, children }: Props) {
  return (
    <header className="border-linea border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={`/${slug}`} className="text-tinta flex min-h-12 min-w-0 items-center gap-3">
          <Avatar src={logo} nombre="" tamano={36} decorativo />
          <span className="font-display truncate text-lg font-bold">{nombre}</span>
        </Link>
        {children}
      </div>
    </header>
  );
}
