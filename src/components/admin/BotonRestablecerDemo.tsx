"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restablecerDemoAccion } from "@/app/[slug]/admin/acciones";
import { BOTON_BORDE } from "./estilos";

/** Solo se muestra en negocios de demostración. Pide confirmación porque borra todas las citas. */
export function BotonRestablecerDemo({ slug }: { slug: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function restablecer() {
    if (trabajando) return;
    setTrabajando(true);
    setMensaje(null);
    try {
      const r = await restablecerDemoAccion(slug);
      if (r.ok) {
        setMensaje({ tipo: "ok", texto: `Demo restablecida: ${r.reservas} citas de ejemplo.` });
        setConfirmando(false);
        router.refresh();
      } else {
        setMensaje({ tipo: "error", texto: r.mensaje });
      }
    } catch {
      setMensaje({ tipo: "error", texto: "No pudimos restablecer. Revisa tu conexión." });
    }
    setTrabajando(false);
  }

  return (
    <section
      aria-labelledby="titulo-demo"
      className="rounded-xl border-2 border-dashed border-neutral-400 p-4"
    >
      <h2 id="titulo-demo" className="font-bold">
        Demo
      </h2>
      <p className="mb-3 text-sm text-neutral-700">
        Esta es una demo con datos ficticios. Puedes volver a dejarla como nueva en cualquier
        momento (también se restablece sola cada día).
      </p>

      {!confirmando ? (
        <button type="button" onClick={() => setConfirmando(true)} className={BOTON_BORDE}>
          Restablecer demo
        </button>
      ) : (
        <div
          role="alertdialog"
          aria-labelledby="titulo-confirmar"
          className="rounded-xl bg-red-50 p-4"
        >
          <p id="titulo-confirmar" className="mb-3 font-semibold text-red-950">
            Se borrarán todas las citas y bloqueos y se crearán datos de ejemplo nuevos. ¿Continuar?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={trabajando}
              onClick={() => void restablecer()}
              className="min-h-12 rounded-xl bg-red-700 px-5 font-bold text-white disabled:opacity-60"
            >
              {trabajando ? "Restableciendo…" : "Sí, restablecer"}
            </button>
            <button
              type="button"
              disabled={trabajando}
              onClick={() => setConfirmando(false)}
              className={BOTON_BORDE}
            >
              No, cancelar
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <p
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={`mt-3 rounded-xl p-3 font-medium ${
            mensaje.tipo === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
          }`}
        >
          {mensaje.texto}
        </p>
      )}
    </section>
  );
}
