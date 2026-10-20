"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearCitaAdminAccion, horariosAdminAccion } from "@/app/[slug]/admin/acciones";
import { formatearHora } from "@/lib/texto";
import { BOTON_PRIMARIO, CAMPO } from "./estilos";

interface Props {
  slug: string;
  servicios: { id: string; nombre: string }[];
  profesionales: { id: string; nombre: string }[];
  fechaInicial: string;
  textoProfesional: string;
  textoReserva: string;
}

interface Seleccion {
  servicioId: string;
  profesionalId: string;
  fecha: string;
}

/** Crear una cita para quien llega sin reserva. Aquí no rige la anticipación mínima. */
export function FormCitaManual({
  slug,
  servicios,
  profesionales,
  fechaInicial,
  textoProfesional,
  textoReserva,
}: Props) {
  const router = useRouter();
  const [sel, setSel] = useState<Seleccion>({
    servicioId: servicios[0]?.id ?? "",
    profesionalId: "cualquiera",
    fecha: fechaInicial,
  });
  const [horas, setHoras] = useState<string[] | null>(null);
  const [hora, setHora] = useState("");
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [notas, setNotas] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const peticion = useRef(0);

  async function cargarHoras(nueva: Seleccion) {
    const esta = ++peticion.current;
    setHoras(null);
    setHora("");
    if (!nueva.servicioId || !nueva.fecha) return;
    const r = await horariosAdminAccion(slug, nueva);
    if (esta !== peticion.current) return;
    if (r.ok) setHoras([...new Set(r.horarios.map((h) => h.hora))]);
    else setMensaje({ tipo: "error", texto: r.mensaje });
  }

  function cambiar(parcial: Partial<Seleccion>) {
    const nueva = { ...sel, ...parcial };
    setSel(nueva);
    setMensaje(null);
    void cargarHoras(nueva);
  }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setErrores({});
    setMensaje(null);
    try {
      const r = await crearCitaAdminAccion(slug, { ...sel, hora, nombre, celular, notas });
      if (r.ok) {
        setMensaje({ tipo: "ok", texto: "Cita guardada." });
        setNombre("");
        setCelular("");
        setNotas("");
        router.refresh();
        void cargarHoras(sel); // la hora usada deja de aparecer
      } else {
        setErrores(r.errores ?? {});
        setMensaje({ tipo: "error", texto: r.mensaje });
        if (r.mensaje.includes("ocupar")) void cargarHoras(sel);
      }
    } catch {
      setMensaje({ tipo: "error", texto: "No pudimos guardar. Revisa tu conexión." });
    }
    setGuardando(false);
  }

  const error = (campo: string) => errores[campo];

  return (
    <details
      className="border-linea rounded-xl border-2 p-4"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && horas === null) void cargarHoras(sel);
      }}
    >
      <summary className="min-h-12 cursor-pointer py-3 font-bold">
        Nueva {textoReserva} (cliente sin reserva)
      </summary>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
        className="mt-3 flex flex-col gap-4"
      >
        <div>
          <label htmlFor="cm-servicio" className="mb-1 block font-semibold">
            Servicio
          </label>
          <select
            id="cm-servicio"
            value={sel.servicioId}
            onChange={(e) => cambiar({ servicioId: e.target.value })}
            className={CAMPO}
          >
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cm-prof" className="mb-1 block font-semibold">
            Con quién ({textoProfesional})
          </label>
          <select
            id="cm-prof"
            value={sel.profesionalId}
            onChange={(e) => cambiar({ profesionalId: e.target.value })}
            className={CAMPO}
          >
            <option value="cualquiera">Cualquiera</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cm-fecha" className="mb-1 block font-semibold">
            Día
          </label>
          <input
            id="cm-fecha"
            type="date"
            value={sel.fecha}
            onChange={(e) => cambiar({ fecha: e.target.value })}
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="cm-hora" className="mb-1 block font-semibold">
            Hora
          </label>
          <select
            id="cm-hora"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            aria-invalid={error("hora") ? true : undefined}
            aria-describedby="cm-hora-ayuda"
            className={CAMPO}
          >
            <option value="">
              {horas === null
                ? "Cargando horas…"
                : horas.length
                  ? "Elige una hora"
                  : "Sin horas libres"}
            </option>
            {horas?.map((h) => (
              <option key={h} value={h}>
                {formatearHora(h)}
              </option>
            ))}
          </select>
          <p id="cm-hora-ayuda" className="text-tinta-suave mt-1 text-sm">
            Aquí no rige la anticipación mínima: puedes registrar a quien ya está en el local.
          </p>
          {error("hora") && (
            <p className="mt-1 text-sm font-medium text-red-700">{error("hora")}</p>
          )}
        </div>
        <div>
          <label htmlFor="cm-nombre" className="mb-1 block font-semibold">
            Nombre del cliente
          </label>
          <input
            id="cm-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="off"
            aria-invalid={error("nombre") ? true : undefined}
            className={CAMPO}
          />
          {error("nombre") && (
            <p className="mt-1 text-sm font-medium text-red-700">{error("nombre")}</p>
          )}
        </div>
        <div>
          <label htmlFor="cm-celular" className="mb-1 block font-semibold">
            Celular (opcional)
          </label>
          <input
            id="cm-celular"
            type="tel"
            inputMode="tel"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            autoComplete="off"
            aria-invalid={error("celular") ? true : undefined}
            className={CAMPO}
          />
          {error("celular") && (
            <p className="mt-1 text-sm font-medium text-red-700">{error("celular")}</p>
          )}
        </div>
        <div>
          <label htmlFor="cm-notas" className="mb-1 block font-semibold">
            Notas (opcional)
          </label>
          <input
            id="cm-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className={CAMPO}
          />
        </div>

        {mensaje && (
          <p
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={`rounded-xl p-3 font-medium ${
              mensaje.tipo === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
            }`}
          >
            {mensaje.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando || !hora || !nombre.trim()}
          className={BOTON_PRIMARIO}
        >
          {guardando ? "Guardando…" : "Guardar cita"}
        </button>
      </form>
    </details>
  );
}
