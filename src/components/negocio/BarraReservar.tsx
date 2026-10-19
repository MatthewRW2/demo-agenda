import Link from "next/link";
import type { Tenant } from "@/lib/tenants/schema";

/** Botón fijo abajo en el celular, para que "Reservar" siempre esté a un toque. */
export function BarraReservar({ tenant }: { tenant: Tenant }) {
  return (
    <section
      aria-label="Reservar ahora"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:hidden"
    >
      <Link
        href={`/${tenant.slug}/reservar`}
        className="bg-acento text-sobre-acento flex min-h-14 w-full items-center justify-center rounded-xl text-lg font-bold"
      >
        Reservar {tenant.textos.reserva}
      </Link>
    </section>
  );
}
