import Link from "next/link";
import type { Booking } from "@/db/schema";
import { ETIQUETA_ESTADO } from "@/lib/estados";
import { enlaceWhatsApp } from "@/lib/enlaces";
import { formatearCOP } from "@/lib/moneda";
import { codigoReserva } from "@/lib/reserva";
import { formatearFechaHora } from "@/lib/fechas";
import type { Tenant } from "@/lib/tenants/schema";
import { BotonesEstado } from "./BotonesEstado";

interface Props {
  tenant: Tenant;
  reserva: Booking;
  /** Enlace para cerrar el detalle y volver a la agenda. */
  hrefCerrar: string;
}

export function DetalleCita({ tenant, reserva, hrefCerrar }: Props) {
  const servicio = tenant.servicios.find((s) => s.id === reserva.serviceId);
  const profesional = tenant.profesionales.find((p) => p.id === reserva.professionalId);

  const filas: [string, string][] = [
    ["Código", codigoReserva(reserva.id)],
    ["Cuándo", formatearFechaHora(reserva.startsAt)],
    [
      "Servicio",
      `${servicio?.nombre ?? reserva.serviceId}${servicio ? ` · ${formatearCOP(servicio.precio)}` : ""}`,
    ],
    ["Con", profesional?.nombre ?? reserva.professionalId],
    ["Estado", ETIQUETA_ESTADO[reserva.status]],
    ["Origen", reserva.source === "admin" ? "Creada en el panel" : "Reserva en línea"],
  ];
  if (reserva.customerEmail) filas.push(["Correo", reserva.customerEmail]);
  if (reserva.notes) filas.push(["Notas", reserva.notes]);

  return (
    <section
      aria-labelledby="detalle-titulo"
      className="border-primario rounded-xl border-2 p-4"
      data-testid="detalle-cita"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 id="detalle-titulo" className="text-xl font-bold">
          {reserva.customerName}
        </h2>
        <Link
          href={hrefCerrar}
          scroll={false}
          className="min-h-12 px-2 py-3 text-sm font-semibold underline underline-offset-4"
        >
          Cerrar
        </Link>
      </div>

      <dl className="mb-4 divide-y divide-neutral-100 text-sm">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex justify-between gap-4 py-2">
            <dt className="text-neutral-600">{etiqueta}</dt>
            <dd className="text-right font-semibold">{valor}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-neutral-600">Celular</dt>
          <dd className="text-right font-semibold">
            {reserva.customerPhone ? (
              <a
                href={enlaceWhatsApp(`57${reserva.customerPhone}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primario underline underline-offset-4"
              >
                {reserva.customerPhone}
                <span className="sr-only"> (abre WhatsApp en otra pestaña)</span>
              </a>
            ) : (
              "No dejó celular"
            )}
          </dd>
        </div>
      </dl>

      <BotonesEstado slug={tenant.slug} id={reserva.id} estadoActual={reserva.status} />
    </section>
  );
}
