import Link from "next/link";
import type { Block, Booking } from "@/db/schema";
import { marcasDeHora, posicionEnAgenda, rangoVisible } from "@/lib/admin/agenda";
import { aFechaHoraBogota } from "@/lib/fechas";
import { ETIQUETA_ESTADO } from "@/lib/estados";
import type { Tenant } from "@/lib/tenants/schema";
import { formatearHora, formatearHoraCorta, pluralizar } from "@/lib/texto";

const PX_POR_MINUTO = 1.4; // 30 min = 42 px: cabe nombre y servicio
const ANCHO_HORAS = 60;

const COLOR_ESTADO: Record<Booking["status"], string> = {
  confirmada: "bg-primario text-sobre-primario",
  completada: "bg-emerald-800 text-white",
  no_asistio: "bg-amber-300 text-tinta",
  cancelada: "bg-linea text-tinta",
};

interface Props {
  tenant: Tenant;
  fecha: string;
  reservas: Booking[];
  bloqueos: Block[];
  seleccionada?: string;
}

/** Agenda de un día: una columna por profesional. Las canceladas no se dibujan (liberan el hueco). */
export function AgendaDia({ tenant, fecha, reservas, bloqueos, seleccionada }: Props) {
  const visibles = reservas.filter((r) => r.status !== "cancelada");
  const canceladas = reservas.length - visibles.length;
  const rango = rangoVisible(tenant, fecha, [...visibles, ...bloqueos]);

  if (!rango) {
    return (
      <p className="bg-papel-2 rounded-xl p-4">
        El local está cerrado este día y no hay citas ni bloqueos.
        {canceladas > 0 && ` (${canceladas} cancelada${canceladas === 1 ? "" : "s"})`}
      </p>
    );
  }

  const { desdeMin, hastaMin } = rango;
  const alto = (hastaMin - desdeMin) * PX_POR_MINUTO;
  const columnas = tenant.profesionales;
  const nombreServicio = new Map(tenant.servicios.map((s) => [s.id, s.nombre]));
  const marcas = marcasDeHora(desdeMin, hastaMin);

  return (
    <div>
      {columnas.length > 2 && (
        <p className="text-tinta-suave mb-2 text-sm md:hidden">
          Desliza hacia los lados para ver a todos los {pluralizar(tenant.textos.profesional)}.
        </p>
      )}
      <div
        className="border-linea overflow-x-auto rounded-xl border"
        role="region"
        aria-label={`Agenda del día, ${columnas.length} columnas`}
        tabIndex={0}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${ANCHO_HORAS}px repeat(${columnas.length}, minmax(150px, 1fr))`,
            minWidth: ANCHO_HORAS + columnas.length * 150,
          }}
        >
          <div className="border-linea bg-papel border-b" />
          {columnas.map((p) => (
            <h2
              key={p.id}
              className="border-linea bg-papel border-b border-l p-2 text-center font-bold"
            >
              {p.nombre}
            </h2>
          ))}

          {/* columna de horas */}
          <div className="relative" style={{ height: alto }} aria-hidden>
            {marcas.map((m) => (
              <span
                key={m}
                className={`text-tinta-suave absolute right-1 text-xs whitespace-nowrap ${m === desdeMin ? "" : "-translate-y-2"}`}
                style={{ top: (m - desdeMin) * PX_POR_MINUTO }}
              >
                {formatearHoraCorta(`${String(m / 60).padStart(2, "0")}:00`)}
              </span>
            ))}
          </div>

          {columnas.map((p) => (
            <div
              key={p.id}
              className="border-linea relative border-l"
              style={{ height: alto }}
              data-columna={p.id}
            >
              {marcas.map((m) => (
                <div
                  key={m}
                  aria-hidden
                  className="border-linea absolute inset-x-0 border-t"
                  style={{ top: (m - desdeMin) * PX_POR_MINUTO }}
                />
              ))}

              {bloqueos
                .filter((b) => b.professionalId === null || b.professionalId === p.id)
                .map((b) => {
                  const pos = posicionEnAgenda(
                    { startsAt: b.startsAt, endsAt: b.endsAt },
                    fecha,
                    desdeMin,
                  );
                  return (
                    <div
                      key={b.id}
                      className="border-borde-control bg-papel-2 text-tinta absolute inset-x-0 overflow-hidden border-y p-1 text-xs"
                      style={{
                        top: pos.topMin * PX_POR_MINUTO,
                        height: pos.altoMin * PX_POR_MINUTO,
                        backgroundImage:
                          "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,.08) 6px, rgba(0,0,0,.08) 12px)",
                      }}
                      data-bloqueo
                    >
                      <strong>Bloqueado</strong>
                      {b.reason ? ` · ${b.reason}` : ""}
                    </div>
                  );
                })}

              {visibles
                .filter((r) => r.professionalId === p.id)
                .map((r) => {
                  const pos = posicionEnAgenda(
                    { startsAt: r.startsAt, endsAt: r.endsAt },
                    fecha,
                    desdeMin,
                  );
                  const hora = formatearHora(aFechaHoraBogota(r.startsAt).hora);
                  const servicio = nombreServicio.get(r.serviceId) ?? r.serviceId;
                  return (
                    <Link
                      key={r.id}
                      href={`/${tenant.slug}/admin?vista=dia&fecha=${fecha}&cita=${r.id}`}
                      scroll={false}
                      aria-current={seleccionada === r.id ? "true" : undefined}
                      data-cita={r.id}
                      className={`absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-xs leading-tight shadow-sm ${COLOR_ESTADO[r.status]} ${
                        seleccionada === r.id ? "ring-acento ring-4" : ""
                      }`}
                      style={{
                        top: pos.topMin * PX_POR_MINUTO + 1,
                        height: Math.max(pos.altoMin * PX_POR_MINUTO - 2, 20),
                      }}
                    >
                      <strong className="block truncate">
                        {hora} · {r.customerName}
                      </strong>
                      <span className="block truncate">
                        {servicio}
                        {r.status !== "confirmada" ? ` · ${ETIQUETA_ESTADO[r.status]}` : ""}
                      </span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
      {canceladas > 0 && (
        <p className="text-tinta-suave mt-2 text-sm">
          {canceladas} cita{canceladas === 1 ? "" : "s"} cancelada{canceladas === 1 ? "" : "s"} este
          día (no se dibuj{canceladas === 1 ? "a" : "an"}: el horario está libre).
        </p>
      )}
    </div>
  );
}
