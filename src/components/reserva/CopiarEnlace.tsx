"use client";

import { useState } from "react";

/** Copia al portapapeles el enlace de la página actual (sin parámetros como ?nueva=1). */
export function CopiarEnlace() {
  const [estado, setEstado] = useState<"inicial" | "copiado" | "fallo">("inicial");

  async function copiar() {
    const url = new URL(window.location.href);
    url.search = "";
    try {
      await navigator.clipboard.writeText(url.toString());
      setEstado("copiado");
    } catch {
      setEstado("fallo");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={copiar}
        className="border-primario-texto text-primario-texto min-h-12 w-full rounded-xl border-2 px-5 font-semibold"
      >
        Copiar enlace de mi cita
      </button>
      <p role="status" className="text-tinta-suave mt-2 min-h-6 text-sm">
        {estado === "copiado" && "¡Enlace copiado!"}
        {estado === "fallo" && "No pudimos copiarlo. Mantén presionada la dirección de la página."}
      </p>
    </div>
  );
}
