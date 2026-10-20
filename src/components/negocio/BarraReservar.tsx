"use client";

import Link from "next/link";
import { enlaceReservar } from "@/lib/enlaces";
import { etiquetaDia } from "@/lib/fechas";
import { formatearHora } from "@/lib/texto";
import { useDisponibilidad } from "./DisponibilidadProvider";

/**
 * Barra fija abajo en el celular: "Reservar" siempre a un toque y, cuando se sabe, el próximo turno
 * libre. El botón es siempre el mismo (lleva al inicio del flujo); el texto del turno es solo informativo.
 */
export function BarraReservar({ slug, textoReserva }: { slug: string; textoReserva: string }) {
  const disp = useDisponibilidad();
  const proximo = disp.estado === "listo" ? disp.datos.proximo : null;
  const turno = proximo?.turnos[0];

  return (
    <section
      aria-label="Reservar ahora"
      className="border-linea bg-papel fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t px-4 py-3 md:hidden"
    >
      {proximo && turno && disp.estado === "listo" && (
        <p className="text-tinta min-w-0 flex-1 text-sm leading-tight">
          <span className="text-tinta-suave block">Próximo turno</span>
          <span className="cifras block truncate font-bold">
            {etiquetaDia(proximo.fecha, disp.datos.fechaHoy)}, {formatearHora(turno.hora)}
          </span>
        </p>
      )}
      <Link
        href={enlaceReservar(slug)}
        className={`bg-acento text-sobre-acento flex min-h-14 items-center justify-center rounded-xl px-6 text-lg font-bold ${proximo ? "shrink-0" : "w-full"}`}
      >
        Reservar {textoReserva}
      </Link>
    </section>
  );
}
