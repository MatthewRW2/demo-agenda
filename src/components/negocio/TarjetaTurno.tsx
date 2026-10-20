"use client";

import Link from "next/link";
import { enlaceReservar } from "@/lib/enlaces";
import { etiquetaDia } from "@/lib/fechas";
import { formatearCOP } from "@/lib/moneda";
import { formatearDuracion, formatearHora } from "@/lib/texto";
import { useDisponibilidad } from "./DisponibilidadProvider";

interface Props {
  slug: string;
  servicios: { id: string; nombre: string; duracionMin: number; precio: number }[];
  profesionales: { id: string; nombre: string }[];
}

const BOTON_TALON =
  "bg-acento text-sobre-acento flex min-h-12 w-full items-center justify-center rounded-xl px-4 font-bold";

/**
 * La tarjeta de cita: un talón con el próximo turno libre de verdad (calculado con el mismo motor que
 * la reserva) y el botón para tomarlo. Cada horario lleva directo al formulario con todo elegido.
 */
export function TarjetaTurno({ slug, servicios, profesionales }: Props) {
  const disp = useDisponibilidad();
  const proximo = disp.estado === "listo" ? disp.datos.proximo : null;
  const principal = proximo?.turnos[0];
  const servicio = servicios.find((s) => s.id === principal?.servicioId);
  const profesional = profesionales.find((p) => p.id === principal?.profesionalId);

  const enlaceTurno = (t: { hora: string; servicioId: string; profesionalId: string }) =>
    enlaceReservar(slug, {
      servicio: t.servicioId,
      profesional: t.profesionalId,
      fecha: proximo?.fecha,
      hora: t.hora,
    });

  return (
    <div className="sombra-tarjeta">
      <div className="tarjeta-turno">
        <div className="flex min-h-[14.5rem] flex-col gap-3 px-5 pt-6 pb-8">
          <h2 className="sr-only">Próximo turno libre</h2>

          {disp.estado === "cargando" && (
            <div aria-hidden className="flex animate-pulse flex-col gap-3">
              <span className="bg-papel-2 h-11 w-40 rounded-lg" />
              <span className="bg-papel-2 h-5 w-48 rounded-md" />
              <span className="bg-papel-2 h-5 w-56 rounded-md" />
            </div>
          )}

          {disp.estado === "cargando" && (
            <p className="sr-only" role="status">
              Buscando el próximo turno…
            </p>
          )}

          {principal && proximo && (
            <>
              <p className="numero-grande text-tinta text-[2.75rem]">
                {formatearHora(principal.hora).replace(/\s+(.*)$/, "")}
                <span className="ml-2 text-xl">
                  {formatearHora(principal.hora).replace(/^\S+\s*/, "")}
                </span>
              </p>
              <p className="text-tinta text-base font-semibold">
                {etiquetaDia(
                  proximo.fecha,
                  disp.estado === "listo" ? disp.datos.fechaHoy : proximo.fecha,
                )}
                {profesional ? ` · con ${profesional.nombre}` : ""}
              </p>
              {servicio && (
                <p className="text-tinta-suave cifras text-sm">
                  {servicio.nombre} · {formatearDuracion(servicio.duracionMin)} ·{" "}
                  {formatearCOP(servicio.precio)}
                </p>
              )}
              {proximo.turnos.length > 1 && (
                <ul className="mt-1 flex flex-wrap gap-2" aria-label="Más horarios libres">
                  {proximo.turnos.slice(1).map((t) => (
                    <li key={t.hora}>
                      <Link
                        href={enlaceTurno(t)}
                        className="border-borde-control text-tinta cifras inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-semibold"
                      >
                        {formatearHora(t.hora)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {disp.estado !== "cargando" && !principal && (
            <>
              <p className="titulo-seccion text-tinta text-[1.75rem]">Elige tu horario</p>
              <p className="text-tinta-suave text-base">
                {disp.estado === "listo"
                  ? "Por ahora no hay turnos libres en los próximos días. Escríbenos y te ayudamos."
                  : "Mira los días y horas disponibles y reserva en un minuto."}
              </p>
            </>
          )}
        </div>

        <div className="flex h-[5.5rem] items-center px-5">
          {principal ? (
            <Link href={enlaceTurno(principal)} className={BOTON_TALON}>
              Reservar este turno
            </Link>
          ) : (
            <Link href={enlaceReservar(slug)} className={BOTON_TALON}>
              Ver horarios
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
