"use client";

import { useDisponibilidad } from "./DisponibilidadProvider";

/**
 * "● Turnos hoy" o "Sin turnos hoy" (en gris) para un profesional. Mismo dato y misma carga que el
 * próximo turno; mientras llega, o si falla, el hueco mantiene su altura para que nada se mueva.
 */
export function IndicadorTurnosHoy({ profesionalId }: { profesionalId: string }) {
  const disp = useDisponibilidad();

  if (disp.estado === "cargando") {
    return <span aria-hidden className="bg-papel-2 inline-block h-5 w-24 rounded-full" />;
  }
  if (disp.estado === "error" || !(profesionalId in disp.datos.hoy)) {
    return <span aria-hidden className="inline-block h-5" />;
  }

  const hay = disp.datos.hoy[profesionalId];
  return (
    <p
      className={`inline-flex h-5 items-center gap-1.5 text-sm font-medium ${hay ? "text-tinta" : "text-tinta-suave"}`}
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${hay ? "bg-emerald-600" : "bg-borde-control"}`}
      />
      {hay ? "Turnos hoy" : "Sin turnos hoy"}
    </p>
  );
}
