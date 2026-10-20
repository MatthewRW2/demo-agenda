"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { borrarBloqueoAccion, crearBloqueoAccion } from "@/app/[slug]/admin/acciones";
import { BOTON_BORDE, BOTON_PRIMARIO, CAMPO } from "./estilos";

interface FormProps {
  slug: string;
  profesionales: { id: string; nombre: string }[];
  fechaInicial: string;
}

export function FormBloqueo({ slug, profesionales, fechaInicial }: FormProps) {
  const router = useRouter();
  const [profesionalId, setProfesionalId] = useState("todos");
  const [fecha, setFecha] = useState(fechaInicial);
  const [desde, setDesde] = useState("12:00");
  const [hasta, setHasta] = useState("14:00");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "aviso" | "error"; texto: string } | null>(
    null,
  );
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setErrores({});
    setMensaje(null);
    try {
      const r = await crearBloqueoAccion(slug, { profesionalId, fecha, desde, hasta, motivo });
      if (r.ok) {
        setMotivo("");
        setMensaje(
          r.citasAfectadas > 0
            ? {
                tipo: "aviso",
                texto: `Horario bloqueado. Ojo: hay ${r.citasAfectadas} ${r.citasAfectadas === 1 ? "cita confirmada" : "citas confirmadas"} en ese rango; siguen activas, cancélalas o muévelas si hace falta.`,
              }
            : { tipo: "ok", texto: "Horario bloqueado." },
        );
        router.refresh();
      } else {
        setErrores(r.errores ?? {});
        setMensaje({ tipo: "error", texto: r.mensaje });
      }
    } catch {
      setMensaje({ tipo: "error", texto: "No pudimos guardar. Revisa tu conexión." });
    }
    setGuardando(false);
  }

  return (
    <details className="border-linea rounded-xl border-2 p-4">
      <summary className="min-h-12 cursor-pointer py-3 font-bold">Bloquear un horario</summary>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
        className="mt-3 flex flex-col gap-4"
      >
        <div>
          <label htmlFor="bl-prof" className="mb-1 block font-semibold">
            A quién
          </label>
          <select
            id="bl-prof"
            value={profesionalId}
            onChange={(e) => setProfesionalId(e.target.value)}
            className={CAMPO}
          >
            <option value="todos">Todo el local</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bl-fecha" className="mb-1 block font-semibold">
            Día
          </label>
          <input
            id="bl-fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={CAMPO}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bl-desde" className="mb-1 block font-semibold">
              Desde
            </label>
            <input
              id="bl-desde"
              type="time"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={CAMPO}
            />
          </div>
          <div>
            <label htmlFor="bl-hasta" className="mb-1 block font-semibold">
              Hasta
            </label>
            <input
              id="bl-hasta"
              type="time"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              aria-invalid={errores.hasta ? true : undefined}
              aria-describedby={errores.hasta ? "bl-hasta-error" : undefined}
              className={CAMPO}
            />
          </div>
        </div>
        {errores.hasta && (
          <p id="bl-hasta-error" className="-mt-2 text-sm font-medium text-red-700">
            {errores.hasta}
          </p>
        )}
        <div>
          <label htmlFor="bl-motivo" className="mb-1 block font-semibold">
            Motivo (opcional)
          </label>
          <input
            id="bl-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={CAMPO}
          />
        </div>

        {mensaje && (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={`rounded-xl p-3 font-medium ${
              mensaje.tipo === "ok"
                ? "bg-emerald-50 text-emerald-900"
                : mensaje.tipo === "aviso"
                  ? "bg-amber-50 text-amber-950"
                  : "bg-red-50 text-red-900"
            }`}
          >
            {mensaje.texto}
          </p>
        )}

        <button type="submit" disabled={guardando} className={BOTON_PRIMARIO}>
          {guardando ? "Guardando…" : "Bloquear horario"}
        </button>
      </form>
    </details>
  );
}

export interface BloqueoVista {
  id: string;
  quien: string;
  rango: string;
  motivo: string | null;
}

export function ListaBloqueos({ slug, bloqueos }: { slug: string; bloqueos: BloqueoVista[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  if (bloqueos.length === 0) return null;

  async function quitar(id: string) {
    setBorrando(id);
    setError(null);
    try {
      const r = await borrarBloqueoAccion(slug, id);
      if (r.ok) router.refresh();
      else setError(r.mensaje);
    } catch {
      setError("No pudimos quitar el bloqueo.");
    }
    setBorrando(null);
  }

  return (
    <section aria-labelledby="bloqueos-dia">
      <h2 id="bloqueos-dia" className="mb-2 font-bold">
        Horarios bloqueados
      </h2>
      <ul className="divide-linea border-linea divide-y rounded-xl border">
        {bloqueos.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 p-3">
            <span>
              <span className="block font-semibold">
                {b.quien} · {b.rango}
              </span>
              {b.motivo && <span className="text-tinta-suave block text-sm">{b.motivo}</span>}
            </span>
            <button
              type="button"
              disabled={borrando === b.id}
              onClick={() => void quitar(b.id)}
              className={BOTON_BORDE}
              aria-label={`Quitar bloqueo de ${b.quien}, ${b.rango}`}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
