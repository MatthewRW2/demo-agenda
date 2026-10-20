"use client";

import { useSyncExternalStore } from "react";
import { estadoApertura, textoApertura } from "@/lib/horario";
import type { Tenant } from "@/lib/tenants/schema";

/** Un tic por minuto: el chip se actualiza solo cuando el negocio abre o cierra. */
function suscribirse(avisar: () => void) {
  const id = setInterval(avisar, 60_000);
  return () => clearInterval(id);
}
const minutoActual = () => Math.floor(Date.now() / 60_000);

/**
 * "Abierto ahora · cierra 7:00 p. m." Se calcula en el navegador con la hora de Bogotá, porque la
 * página es estática y un texto fijo mentiría en cuanto el negocio cierre. Hasta entonces se reserva
 * el mismo espacio para que nada se mueva al aparecer.
 */
export function ChipApertura({ horario }: { horario: Tenant["horario"] }) {
  const minuto = useSyncExternalStore(suscribirse, minutoActual, () => null);

  if (minuto === null) {
    return <span aria-hidden className="bg-sobre-primario/15 inline-block h-9 w-60 rounded-full" />;
  }
  const estado = estadoApertura({ horario }, new Date(minuto * 60_000));
  return (
    <p className="bg-sobre-primario/15 inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold">
      <span
        aria-hidden
        className={`size-2.5 rounded-full ${estado.estado === "abierto" ? "bg-emerald-400" : "bg-sobre-primario/60"}`}
      />
      {textoApertura(estado)}
    </p>
  );
}
