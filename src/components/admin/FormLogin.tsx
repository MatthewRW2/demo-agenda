"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iniciarSesionAccion } from "@/app/[slug]/admin/acciones";
import { BOTON_PRIMARIO, CAMPO } from "./estilos";

interface Props {
  slug: string;
  nombreNegocio: string;
  /** Solo en modo demo: se muestra para que el prospecto pueda entrar. */
  contrasenaDemo?: string;
}

export function FormLogin({ slug, nombreNegocio, contrasenaDemo }: Props) {
  const router = useRouter();
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await iniciarSesionAccion(slug, contrasena);
      if (r.ok) {
        router.refresh();
        return;
      }
      setError(r.mensaje);
    } catch {
      setError("No pudimos entrar. Revisa tu conexión e inténtalo de nuevo.");
    }
    setEnviando(false);
  }

  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10"
    >
      <div className="border-linea flex flex-col gap-5 rounded-2xl border bg-white p-6 sm:p-8">
        <div>
          <h1 className="titulo-seccion text-tinta">Panel de {nombreNegocio}</h1>
          <p className="text-tinta-suave mt-1">Escribe la contraseña para ver la agenda.</p>
        </div>

        {contrasenaDemo && (
          <p className="border-borde-control bg-papel rounded-xl border-2 border-dashed p-4 text-sm">
            <strong>Demo con datos ficticios.</strong> La contraseña es{" "}
            <code
              className="rounded bg-white px-1.5 py-0.5 font-bold"
              data-testid="contrasena-demo"
            >
              {contrasenaDemo}
            </code>
          </p>
        )}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="contrasena" className="mb-1 block font-semibold">
              Contraseña
            </label>
            <input
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "error-login" : undefined}
              className={CAMPO}
            />
            {error && (
              <p id="error-login" role="alert" className="mt-1 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={enviando || !contrasena}
            className={`${BOTON_PRIMARIO} min-h-14`}
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
