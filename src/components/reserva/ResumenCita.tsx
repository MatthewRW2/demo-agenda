import { formatearFechaLarga } from "@/lib/fechas";
import { formatearCOP } from "@/lib/moneda";
import { formatearDuracion, formatearHora } from "@/lib/texto";
import type { TenantPublico } from "./tipos";

interface Props {
  tenant: TenantPublico;
  servicioId: string | null;
  /** "cualquiera" cuando el cliente no escogió a nadie en particular. */
  profesionalId: string | null;
  fecha: string | null;
  hora: string | null;
}

function datosDe({ tenant, servicioId, profesionalId, fecha, hora }: Props) {
  const servicio = tenant.servicios.find((s) => s.id === servicioId);
  const profesional = tenant.profesionales.find((p) => p.id === profesionalId);
  return {
    servicio,
    con: profesionalId === "cualquiera" ? "El primero que esté libre" : profesional?.nombre,
    cuando: fecha ? `${formatearFechaLarga(fecha)}${hora ? `, ${formatearHora(hora)}` : ""}` : null,
  };
}

/**
 * El resumen de la cita como un tiquete: cada elección aparece al hacerla y el talón lleva el total.
 * Se ve a un lado en pantallas anchas; en el celular lo reemplaza `BarraResumen`.
 */
export function ResumenCita(props: Props) {
  const { servicio, con, cuando } = datosDe(props);
  const filas: [string, string | undefined][] = [
    ["Servicio", servicio?.nombre],
    ["Con", con],
    ["Cuándo", cuando ?? undefined],
  ];

  return (
    <aside aria-label={`Resumen de tu ${props.tenant.textos.reserva}`} className="sombra-tarjeta">
      <div className="tarjeta-turno">
        <div className="px-5 pt-6 pb-7">
          <p className="font-display text-tinta mb-4 text-xl font-bold">
            Tu {props.tenant.textos.reserva}
          </p>
          <dl className="flex flex-col gap-3">
            {filas.map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt className="text-tinta-suave text-sm">{etiqueta}</dt>
                <dd
                  className={`text-base text-pretty ${valor ? "text-tinta font-semibold" : "text-tinta-suave"}`}
                >
                  {valor ?? "Por elegir"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex h-[5.5rem] items-center justify-between gap-4 px-5">
          <div>
            <p className="text-tinta-suave text-sm">Total</p>
            {servicio && (
              <p className="text-tinta-suave cifras text-sm">
                {formatearDuracion(servicio.duracionMin)}
              </p>
            )}
          </div>
          <p className="numero-grande text-tinta text-3xl">
            {servicio ? formatearCOP(servicio.precio) : "—"}
          </p>
        </div>
      </div>
    </aside>
  );
}

/** Versión del celular: una barra fija abajo con lo elegido y el total, siempre a la vista. */
export function BarraResumen(props: Props) {
  const { servicio, con, cuando } = datosDe(props);
  const partes = [servicio?.nombre, con, cuando].filter(Boolean);

  return (
    <section
      aria-label={`Resumen de tu ${props.tenant.textos.reserva}`}
      className="border-linea bg-papel fixed inset-x-0 bottom-0 z-20 flex items-center gap-4 border-t px-4 py-3 lg:hidden"
    >
      <p className="text-tinta min-w-0 flex-1 text-sm leading-snug font-semibold">
        {partes.length > 0 ? (
          <span className="line-clamp-2">{partes.join(" · ")}</span>
        ) : (
          <span className="text-tinta-suave font-normal">
            Aquí verás el resumen de tu {props.tenant.textos.reserva}.
          </span>
        )}
      </p>
      {servicio && (
        <p className="numero-grande text-tinta shrink-0 text-xl">{formatearCOP(servicio.precio)}</p>
      )}
    </section>
  );
}
