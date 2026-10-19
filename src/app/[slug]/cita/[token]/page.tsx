import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconoCalendario, IconoWhatsApp } from "@/components/iconos";
import { CopiarEnlace } from "@/components/reserva/CopiarEnlace";
import { GestionCita } from "@/components/reserva/GestionCita";
import { getDb } from "@/db";
import { diasDisponibles } from "@/lib/disponibilidad";
import { enlaceGoogleCalendar, enlaceWhatsApp } from "@/lib/enlaces";
import { formatearFechaHora } from "@/lib/fechas";
import { formatearCOP } from "@/lib/moneda";
import { ETIQUETA_ESTADO } from "@/lib/estados";
import { codigoReserva, enlaceConfirmarPorWhatsApp } from "@/lib/reserva";
import { obtenerTenant } from "@/lib/tenants/obtener";
import { buscarReservaPorToken } from "@/server/reservas/consultas";
import { evaluarGestion } from "@/server/reservas/gestion";

export const dynamic = "force-dynamic";

// El enlace es secreto: no se indexa y no se envía como referencia a otros sitios.
export const metadata: Metadata = {
  title: "Tu cita",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const BOTON_SECUNDARIO =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primario px-5 font-semibold text-primario";

export default async function PaginaCita({
  params,
  searchParams,
}: PageProps<"/[slug]/cita/[token]">) {
  const { slug, token } = await params;
  const { nueva, cambiada } = await searchParams;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  const reserva = await buscarReservaPorToken(getDb(), slug, token);
  if (!reserva) notFound();

  const servicio = tenant.servicios.find((s) => s.id === reserva.serviceId);
  const profesional = tenant.profesionales.find((p) => p.id === reserva.professionalId);
  const codigo = codigoReserva(reserva.id);
  const ahora = new Date();
  const activa = reserva.status === "confirmada";
  const permiso = evaluarGestion(tenant, reserva, ahora);
  // Confirmada y todavía por venir: es la única que muestra acciones.
  const vigente = activa && reserva.startsAt > ahora;
  const nombreServicio = servicio?.nombre ?? reserva.serviceId;
  const nombreProfesional = profesional?.nombre ?? reserva.professionalId;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      {nueva && activa && (
        <div
          role="status"
          className="bg-primario text-sobre-primario mb-6 rounded-xl p-5 text-center"
        >
          <p className="text-2xl font-bold">¡Listo, {reserva.customerName.split(" ")[0]}!</p>
          <p className="mt-1">Tu {tenant.textos.reserva} quedó reservada.</p>
        </div>
      )}

      {cambiada && vigente && (
        <div
          role="status"
          className="bg-primario text-sobre-primario mb-6 rounded-xl p-5 text-center"
        >
          <p className="text-2xl font-bold">Listo, cambiamos tu {tenant.textos.reserva}.</p>
          <p className="mt-1">Revisa el nuevo horario aquí abajo.</p>
        </div>
      )}

      <h1 className="mb-1 text-2xl font-bold">
        {activa
          ? `Tu ${tenant.textos.reserva}`
          : `Tu ${tenant.textos.reserva} (${ETIQUETA_ESTADO[reserva.status].toLowerCase()})`}
      </h1>
      <p className="mb-5 text-neutral-700">{tenant.nombre}</p>

      <dl className="mb-6 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
        {[
          ["Código", codigo],
          ["Estado", ETIQUETA_ESTADO[reserva.status]],
          ["Servicio", `${nombreServicio}${servicio ? ` · ${formatearCOP(servicio.precio)}` : ""}`],
          ["Con", nombreProfesional],
          ["Cuándo", formatearFechaHora(reserva.startsAt)],
          ["Dónde", tenant.direccion],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex justify-between gap-4 p-3 px-4">
            <dt className="text-neutral-600">{etiqueta}</dt>
            <dd className="text-right font-semibold text-balance">{valor}</dd>
          </div>
        ))}
      </dl>

      {vigente ? (
        <div className="flex flex-col gap-3">
          <a
            href={enlaceConfirmarPorWhatsApp({
              tenant,
              nombreCliente: reserva.customerName,
              servicio: nombreServicio,
              profesional: nombreProfesional,
              inicio: reserva.startsAt,
              codigo,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-acento text-sobre-acento inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl text-lg font-bold"
          >
            <IconoWhatsApp />
            Confirmar por WhatsApp
            <span className="sr-only"> (abre en otra pestaña)</span>
          </a>
          <a
            href={enlaceGoogleCalendar({
              titulo: `${nombreServicio} en ${tenant.nombre}`,
              inicio: reserva.startsAt,
              fin: reserva.endsAt,
              detalles: `Código de reserva: ${codigo}`,
              lugar: tenant.direccion,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className={BOTON_SECUNDARIO}
          >
            <IconoCalendario />
            Agregar a Google Calendar
            <span className="sr-only"> (abre en otra pestaña)</span>
          </a>
          <CopiarEnlace />
          <p className="text-sm text-neutral-700">
            Guarda este enlace: con él puedes volver a ver tu {tenant.textos.reserva}.
          </p>

          {permiso.ok ? (
            <GestionCita
              slug={slug}
              token={token}
              textoReserva={tenant.textos.reserva}
              nombreProfesional={nombreProfesional}
              inicioActual={formatearFechaHora(reserva.startsAt)}
              dias={diasDisponibles(tenant, ahora)}
            />
          ) : (
            <div className="rounded-xl bg-neutral-100 p-4">
              <p>
                Ya falta poco para tu {tenant.textos.reserva}: solo se puede cancelar o cambiar con
                al menos {tenant.anticipacionMinHoras}{" "}
                {tenant.anticipacionMinHoras === 1 ? "hora" : "horas"} de anticipación.
              </p>
              <a
                href={enlaceWhatsApp(
                  tenant.whatsapp,
                  `Hola, necesito cambiar o cancelar mi ${tenant.textos.reserva}. Código: ${codigo}.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primario mt-2 inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
              >
                Escríbenos por WhatsApp<span className="sr-only"> (abre en otra pestaña)</span>
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-neutral-100 p-4">
          {activa
            ? `Esta ${tenant.textos.reserva} ya pasó.`
            : `Esta ${tenant.textos.reserva} ya no está activa.`}{" "}
          <Link
            href={`/${slug}/reservar`}
            className="text-primario font-semibold underline underline-offset-4"
          >
            Reservar de nuevo
          </Link>
        </p>
      )}

      <p className="mt-8 text-center">
        <Link
          href={`/${slug}`}
          className="text-primario font-semibold underline underline-offset-4"
        >
          Volver a {tenant.nombre}
        </Link>
      </p>
    </main>
  );
}
