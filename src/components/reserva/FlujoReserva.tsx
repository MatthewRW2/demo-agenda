"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obtenerHorariosAccion, reservarAccion } from "@/app/[slug]/reservar/acciones";
import { erroresPorCampo, reservaSchema } from "@/lib/validacion";
import { PasoDatos } from "./PasoDatos";
import { PasoFechaHora } from "./PasoFechaHora";
import { PasoProfesional } from "./PasoProfesional";
import { PasoServicio } from "./PasoServicio";
import {
  PASOS,
  type DatosFormulario,
  type EstadoHorarios,
  type Paso,
  type TenantPublico,
} from "./tipos";

interface Props {
  tenant: TenantPublico;
  /** Fechas reservables (YYYY-MM-DD) en que el local abre. */
  dias: string[];
}

export function FlujoReserva({ tenant, dias }: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("servicio");
  const [servicioId, setServicioId] = useState<string | null>(null);
  const [profesionalId, setProfesionalId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<EstadoHorarios>({ estado: "inicial" });
  const [datos, setDatos] = useState<DatosFormulario>({ nombre: "", celular: "", correo: "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);
  const peticion = useRef(0);

  // Al cambiar de paso, el foco va al título: lectores de pantalla y teclado siguen el flujo.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, [paso]);

  const numeroPaso = PASOS.indexOf(paso) + 1;
  const textos = tenant.textos;
  const TITULOS: Record<Paso, string> = {
    servicio: "¿Qué servicio quieres?",
    profesional: `¿Con qué ${textos.profesional}?`,
    fechaHora: "¿Cuándo?",
    datos: "Tus datos",
  };

  async function cargarHorarios(f: string, servicio: string, profesional: string) {
    const esta = ++peticion.current;
    setHorarios({ estado: "cargando" });
    const r = await obtenerHorariosAccion(tenant.slug, {
      servicioId: servicio,
      profesionalId: profesional,
      fecha: f,
    });
    if (esta !== peticion.current) return; // llegó tarde: el cliente ya cambió de día
    setHorarios(
      r.ok
        ? { estado: "listo", horas: r.horarios.map((h) => h.hora) }
        : { estado: "error", mensaje: r.mensaje },
    );
  }

  function elegirServicio(id: string) {
    setServicioId(id);
    setProfesionalId(null);
    setFecha(null);
    setHora(null);
    setHorarios({ estado: "inicial" });
    setPaso("profesional");
  }

  function elegirProfesional(id: string) {
    setProfesionalId(id);
    setFecha(null);
    setHora(null);
    setHorarios({ estado: "inicial" });
    setAviso(null);
    setPaso("fechaHora");
  }

  function elegirFecha(f: string) {
    setFecha(f);
    setHora(null);
    setAviso(null);
    if (servicioId && profesionalId) void cargarHorarios(f, servicioId, profesionalId);
  }

  function elegirHora(h: string) {
    setHora(h);
    setErrorGeneral(null);
    setPaso("datos");
  }

  function atras() {
    const anterior = PASOS[PASOS.indexOf(paso) - 1];
    if (anterior) setPaso(anterior);
  }

  function cambiarDato(campo: keyof DatosFormulario, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => {
      if (!e[campo]) return e;
      const { [campo]: _quitado, ...resto } = e;
      void _quitado;
      return resto;
    });
  }

  async function enviar() {
    if (!servicioId || !profesionalId || !fecha || !hora || enviando) return;
    const entrada = { servicioId, profesionalId, fecha, hora, ...datos };

    const local = reservaSchema.safeParse(entrada);
    if (!local.success) {
      setErrores(erroresPorCampo(local.error));
      setErrorGeneral("Revisa los datos marcados.");
      return;
    }

    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);
    try {
      const r = await reservarAccion(tenant.slug, entrada);
      if (r.ok) {
        router.push(`/${tenant.slug}/cita/${r.token}?nueva=1`);
        return; // se queda en "Reservando…" mientras navega
      }
      if (r.codigo === "horario_ocupado") {
        // Se ocupó mientras llenaba los datos: de vuelta a las horas, ya actualizadas.
        setAviso(r.mensaje);
        setHora(null);
        setPaso("fechaHora");
        void cargarHorarios(fecha, servicioId, profesionalId);
      } else {
        setErrores(r.errores ?? {});
        setErrorGeneral(r.mensaje);
      }
    } catch {
      setErrorGeneral("No pudimos completar tu reserva. Revisa tu conexión e inténtalo de nuevo.");
    }
    setEnviando(false);
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <nav aria-label="Progreso" className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm text-neutral-700">
          {numeroPaso > 1 ? (
            <button
              type="button"
              onClick={atras}
              className="min-h-12 pr-4 font-semibold underline underline-offset-4"
            >
              ← Atrás
            </button>
          ) : (
            <Link
              href={`/${tenant.slug}`}
              className="inline-flex min-h-12 items-center pr-4 font-semibold underline underline-offset-4"
            >
              ← Volver
            </Link>
          )}
          <span>
            Paso {numeroPaso} de {PASOS.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={PASOS.length}
          aria-valuenow={numeroPaso}
          aria-label={`Paso ${numeroPaso} de ${PASOS.length}`}
          className="h-2 overflow-hidden rounded-full bg-neutral-200"
        >
          <div
            className="bg-primario h-full transition-all"
            style={{ width: `${(numeroPaso / PASOS.length) * 100}%` }}
          />
        </div>
      </nav>

      <h1 ref={titulo} tabIndex={-1} className="mb-5 text-2xl font-bold outline-none">
        {TITULOS[paso]}
      </h1>

      {aviso && paso === "fechaHora" && (
        <p
          className="mb-4 rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950"
          role="alert"
        >
          {aviso}
        </p>
      )}

      {paso === "servicio" && <PasoServicio tenant={tenant} onElegir={elegirServicio} />}

      {paso === "profesional" && servicioId && (
        <PasoProfesional tenant={tenant} servicioId={servicioId} onElegir={elegirProfesional} />
      )}

      {paso === "fechaHora" && (
        <PasoFechaHora
          dias={dias}
          fecha={fecha}
          horarios={horarios}
          onElegirFecha={elegirFecha}
          onElegirHora={elegirHora}
          onReintentar={() =>
            fecha &&
            servicioId &&
            profesionalId &&
            void cargarHorarios(fecha, servicioId, profesionalId)
          }
        />
      )}

      {paso === "datos" && servicioId && profesionalId && fecha && hora && (
        <PasoDatos
          tenant={tenant}
          servicioId={servicioId}
          profesionalId={profesionalId}
          fecha={fecha}
          hora={hora}
          datos={datos}
          errores={errores}
          errorGeneral={errorGeneral}
          enviando={enviando}
          onCambio={cambiarDato}
          onEnviar={enviar}
        />
      )}
    </div>
  );
}
