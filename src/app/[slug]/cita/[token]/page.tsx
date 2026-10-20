import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconoCalendario, IconoWhatsApp } from "@/components/iconos";
import { CabeceraSimple } from "@/components/negocio/CabeceraSimple";
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
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primario-texto px-5 font-semibold text-primario-texto";

const ENLACE = "text-primario-texto font-semibold underline underline-offset-4";

/** La marca de "listo": un círculo y una palomita que se dibujan una vez, al llegar de reservar o cambiar. */
function Insignia() {
  return (
    <span
      aria-hidden
      className="confirmacion-insignia bg-primario text-sobre-primario mx-auto flex size-16 items-center justify-center rounded-full"
    >
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <circle
          cx="17"
          cy="17"
          r="14"
          stroke="currentColor"
          strokeWidth="2.5"
          pathLength="1"
          className="confirmacion-trazo"
          opacity="0.45"
        />
        <path
          d="M10.5 17.5l4.5 4.5 8.5-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          className="confirmacion-trazo confirmacion-trazo-check"
        />
      </svg>
    </span>
  );
}

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
    <div className="bg-papel flex flex-1 flex-col">
      <CabeceraSimple slug={slug} nombre={tenant.nombre} logo={tenant.logo} />

      <main id="contenido" className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        {nueva && activa && (
          <div role="status" className="mb-8 text-center">
            <Insignia />
            <p className="titulo-seccion text-tinta mt-4">
              ¡Listo, {reserva.customerName.split(" ")[0]}!
            </p>
            <p className="text-tinta-suave mt-1 text-lg">
              Tu {tenant.textos.reserva} quedó reservada.
            </p>
          </div>
        )}

        {cambiada && vigente && (
          <div role="status" className="mb-8 text-center">
            <Insignia />
            <p className="titulo-seccion text-tinta mt-4">
              Listo, cambiamos tu {tenant.textos.reserva}.
            </p>
            <p className="text-tinta-suave mt-1 text-lg">Revisa el nuevo horario aquí abajo.</p>
          </div>
        )}

        <h1 className="font-display text-tinta mb-4 text-2xl font-bold">
          {activa
            ? `Tu ${tenant.textos.reserva}`
            : `Tu ${tenant.textos.reserva} (${ETIQUETA_ESTADO[reserva.status].toLowerCase()})`}
        </h1>

        <div className="sombra-tarjeta mb-8">
          <div className="tarjeta-turno">
            <dl className="px-5 pt-6 pb-7">
              {[
                [
                  "Servicio",
                  `${nombreServicio}${servicio ? ` · ${formatearCOP(servicio.precio)}` : ""}`,
                ],
                ["Con", nombreProfesional],
                ["Cuándo", formatearFechaHora(reserva.startsAt)],
                ["Dónde", tenant.direccion],
              ].map(([etiqueta, valor], i) => (
                <div key={etiqueta} className={i > 0 ? "pt-3.5" : ""}>
                  <dt className="text-tinta-suave text-sm">{etiqueta}</dt>
                  <dd className="text-tinta text-base font-semibold text-balance">{valor}</dd>
                </div>
              ))}
            </dl>
            <div className="flex h-[5.5rem] items-center justify-between gap-4 px-5">
              <div>
                <p className="text-tinta-suave text-sm">Código</p>
                <p className="numero-grande text-tinta text-2xl tracking-wider">{codigo}</p>
              </div>
              <p
                className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${
                  activa ? "bg-primario text-sobre-primario" : "bg-papel-2 text-tinta"
                }`}
              >
                {ETIQUETA_ESTADO[reserva.status]}
              </p>
            </div>
          </div>
        </div>

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
            <p className="text-tinta-suave text-sm">
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
              <div className="bg-papel-2 text-tinta rounded-xl p-4">
                <p>
                  Ya falta poco para tu {tenant.textos.reserva}: solo se puede cancelar o cambiar
                  con al menos {tenant.anticipacionMinHoras}{" "}
                  {tenant.anticipacionMinHoras === 1 ? "hora" : "horas"} de anticipación.
                </p>
                <a
                  href={enlaceWhatsApp(
                    tenant.whatsapp,
                    `Hola, necesito cambiar o cancelar mi ${tenant.textos.reserva}. Código: ${codigo}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ENLACE} mt-2 inline-flex min-h-12 items-center`}
                >
                  Escríbenos por WhatsApp<span className="sr-only"> (abre en otra pestaña)</span>
                </a>
              </div>
            )}
          </div>
        ) : (
          <p className="bg-papel-2 text-tinta rounded-xl p-4">
            {activa
              ? `Esta ${tenant.textos.reserva} ya pasó.`
              : `Esta ${tenant.textos.reserva} ya no está activa.`}{" "}
            <Link href={`/${slug}/reservar`} className={ENLACE}>
              Reservar de nuevo
            </Link>
          </p>
        )}

        <p className="mt-8 text-center">
          <Link href={`/${slug}`} className={`${ENLACE} inline-flex min-h-12 items-center`}>
            Volver a {tenant.nombre}
          </Link>
        </p>
      </main>
    </div>
  );
}
