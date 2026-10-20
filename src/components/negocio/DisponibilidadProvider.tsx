"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DisponibilidadPublica } from "@/server/reservas/disponibilidadPublica";

type Estado =
  { estado: "cargando" } | { estado: "listo"; datos: DisponibilidadPublica } | { estado: "error" };

const Contexto = createContext<Estado>({ estado: "cargando" });

/**
 * Pide los turnos libres UNA vez, después de que la página ya cargó (la página en sí es estática y
 * rápida), y los comparte con la tarjeta de turno, los indicadores de cada profesional y la barra
 * fija. Si la petición falla, las piezas simplemente se quedan sin el dato: nada se rompe.
 */
export function DisponibilidadProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ estado: "cargando" });

  useEffect(() => {
    const control = new AbortController();
    fetch(`/api/disponibilidad/${slug}`, { signal: control.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { ok: boolean } & DisponibilidadPublica) => {
        setEstado(j.ok ? { estado: "listo", datos: j } : { estado: "error" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setEstado({ estado: "error" });
      });
    return () => control.abort();
  }, [slug]);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useDisponibilidad(): Estado {
  return useContext(Contexto);
}
