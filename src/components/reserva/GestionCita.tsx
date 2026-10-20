"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelarCitaAccion,
  horariosCitaAccion,
  reprogramarCitaAccion,
} from "@/app/[slug]/cita/[token]/acciones";
import { formatearFechaLarga } from "@/lib/fechas";
import { formatearHora } from "@/lib/texto";
import { PasoFechaHora } from "./PasoFechaHora";
import type { EstadoHorarios } from "./tipos";

interface Props {
  slug: string;
  token: string;
  /** "cita", "reserva"... según el negocio. */
  textoReserva: string;
  nombreProfesional: string;
  inicioActual: string;
  dias: string[];
}

type Modo = "menu" | "cancelar" | "reprogramar";

const BOTON_BORDE =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-primario-texto px-5 font-semibold text-primario-texto";

export function GestionCita({
  slug,
  token,
  textoReserva,
  nombreProfesional,
  inicioActual,
  dias,
}: Props) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("menu");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<EstadoHorarios>({ estado: "inicial" });
  const titulo = useRef<HTMLHeadingElement>(null);
  const peticion = useRef(0);
  const primeraVez = useRef(true);

  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    titulo.current?.focus();
  }, [modo]);

  function abrir(nuevo: Modo) {
    setError(null);
    setFecha(null);
    setHora(null);
    setHorarios({ estado: "inicial" });
    setModo(nuevo);
  }

  async function cargarHorarios(f: string) {
    const esta = ++peticion.current;
    setHorarios({ estado: "cargando" });
    const r = await horariosCitaAccion(slug, token, f);
    if (esta !== peticion.current) return;
    setHorarios(
      r.ok
        ? { estado: "listo", horas: r.horarios.map((h) => h.hora) }
        : { estado: "error", mensaje: r.mensaje },
    );
  }

  function elegirFecha(f: string) {
    setFecha(f);
    setHora(null);
    setError(null);
    void cargarHorarios(f);
  }

  async function cancelar() {
    if (trabajando) return;
    setTrabajando(true);
    setError(null);
    try {
      const r = await cancelarCitaAccion(slug, token);
      if (r.ok || r.codigo === "no_activa") {
        router.refresh(); // la página muestra el estado cancelado
        return;
      }
      setError(r.mensaje);
    } catch {
      setError("No pudimos cancelar. Revisa tu conexión e inténtalo de nuevo.");
    }
    setTrabajando(false);
  }

  async function confirmarCambio() {
    if (!fecha || !hora || trabajando) return;
    setTrabajando(true);
    setError(null);
    try {
      const r = await reprogramarCitaAccion(slug, token, fecha, hora);
      if (r.ok) {
        // El componente sigue montado al navegar: se reinicia para no dejar el panel viejo abierto.
        abrir("menu");
        setTrabajando(false);
        router.push(`/${slug}/cita/${token}?cambiada=1`);
        router.refresh();
        return;
      }
      setError(r.mensaje);
      if (r.codigo === "horario_ocupado") {
        setHora(null);
        void cargarHorarios(fecha); // la lista se actualiza sin ese horario
      }
    } catch {
      setError("No pudimos hacer el cambio. Revisa tu conexión e inténtalo de nuevo.");
    }
    setTrabajando(false);
  }

  if (modo === "menu") {
    return (
      <div className="border-linea flex flex-col gap-3 border-t-2 border-dashed pt-6">
        <h2 className="font-display text-tinta text-xl font-bold">¿Cambió algo?</h2>
        <button type="button" onClick={() => abrir("reprogramar")} className={BOTON_BORDE}>
          Cambiar día u hora
        </button>
        <button
          type="button"
          onClick={() => abrir("cancelar")}
          className="min-h-12 w-full rounded-xl px-5 font-semibold text-red-800 underline underline-offset-4"
        >
          Cancelar mi {textoReserva}
        </button>
      </div>
    );
  }

  if (modo === "cancelar") {
    return (
      <section
        aria-labelledby="titulo-cancelar"
        className="rounded-xl border-2 border-red-300 bg-red-50 p-5"
      >
        <h2
          id="titulo-cancelar"
          ref={titulo}
          tabIndex={-1}
          className="font-display text-tinta text-xl font-bold outline-none"
        >
          ¿Seguro que quieres cancelar?
        </h2>
        <p className="mt-1 mb-4">
          Tu {textoReserva} del {inicioActual} quedará cancelada y el horario se liberará.
        </p>
        {error && (
          <p role="alert" className="mb-3 font-medium text-red-900">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={cancelar}
            disabled={trabajando}
            className="min-h-12 w-full rounded-xl bg-red-700 px-5 font-bold text-white disabled:opacity-60"
          >
            {trabajando ? "Cancelando…" : `Sí, cancelar mi ${textoReserva}`}
          </button>
          <button type="button" onClick={() => abrir("menu")} className={BOTON_BORDE}>
            No, mantenerla
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="titulo-cambiar"
      className="border-linea rounded-2xl border-2 bg-white p-5"
    >
      <h2
        id="titulo-cambiar"
        ref={titulo}
        tabIndex={-1}
        className="font-display text-tinta text-xl font-bold outline-none"
      >
        Elige el nuevo día y hora
      </h2>
      <p className="text-tinta-suave mt-1 mb-4">
        Con {nombreProfesional} · ahora: {inicioActual}
      </p>

      <PasoFechaHora
        dias={dias}
        fecha={fecha}
        horarios={horarios}
        onElegirFecha={elegirFecha}
        horaElegida={hora}
        onElegirHora={(h) => {
          setHora(h);
          setError(null);
        }}
        onReintentar={() => fecha && void cargarHorarios(fecha)}
      />

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950"
        >
          {error}
        </p>
      )}

      {fecha && hora && (
        <div className="bg-papel-2 mt-5 rounded-xl p-4" role="status">
          <p className="mb-3">
            Mover a{" "}
            <strong>
              {formatearFechaLarga(fecha)}, {formatearHora(hora)}
            </strong>
          </p>
          <button
            type="button"
            onClick={confirmarCambio}
            disabled={trabajando}
            className="bg-acento text-sobre-acento min-h-14 w-full rounded-xl text-lg font-bold disabled:opacity-60"
          >
            {trabajando ? "Cambiando…" : "Confirmar cambio"}
          </button>
        </div>
      )}

      <button type="button" onClick={() => abrir("menu")} className={`${BOTON_BORDE} mt-4`}>
        Volver
      </button>
    </section>
  );
}
