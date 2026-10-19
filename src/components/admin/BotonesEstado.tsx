"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoAccion } from "@/app/[slug]/admin/acciones";
import { ESTADOS_RESERVA } from "@/db/schema";
import { ETIQUETA_ESTADO, type EstadoReserva } from "@/lib/estados";
import { BOTON_BORDE } from "./estilos";

const ACCION: Record<EstadoReserva, string> = {
  confirmada: "Volver a confirmada",
  completada: "Marcar completada",
  no_asistio: "Marcar no asistió",
  cancelada: "Cancelar cita",
};

export function BotonesEstado({
  slug,
  id,
  estadoActual,
}: {
  slug: string;
  id: string;
  estadoActual: EstadoReserva;
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState<EstadoReserva | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(estado: EstadoReserva) {
    if (trabajando) return;
    setTrabajando(estado);
    setError(null);
    try {
      const r = await cambiarEstadoAccion(slug, id, estado);
      if (r.ok) router.refresh();
      else setError(r.mensaje);
    } catch {
      setError("No pudimos cambiar el estado. Inténtalo de nuevo.");
    }
    setTrabajando(null);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {ESTADOS_RESERVA.filter((e) => e !== estadoActual).map((estado) => (
          <button
            key={estado}
            type="button"
            disabled={trabajando !== null}
            onClick={() => void cambiar(estado)}
            className={BOTON_BORDE}
            aria-label={`${ACCION[estado]} (pasará a ${ETIQUETA_ESTADO[estado].toLowerCase()})`}
          >
            {trabajando === estado ? "Guardando…" : ACCION[estado]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
