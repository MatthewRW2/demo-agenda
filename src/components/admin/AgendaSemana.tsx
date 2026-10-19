import Link from "next/link";
import type { Booking } from "@/db/schema";
import { aFechaHoraBogota, formatearFechaLarga } from "@/lib/fechas";
import { ETIQUETA_ESTADO } from "@/lib/estados";
import { sumarDias } from "@/lib/disponibilidad";
import type { Tenant } from "@/lib/tenants/schema";
import { formatearHora } from "@/lib/texto";

interface Props {
  tenant: Tenant;
  lunes: string;
  reservas: Booking[];
}

/** La semana como lista por día: se lee bien en el celular y cada cita abre su detalle. */
export function AgendaSemana({ tenant, lunes, reservas }: Props) {
  const nombreServicio = new Map(tenant.servicios.map((s) => [s.id, s.nombre]));
  const nombreProfesional = new Map(tenant.profesionales.map((p) => [p.id, p.nombre]));
  const porDia = new Map<string, Booking[]>();
  for (const r of reservas) {
    const { fecha } = aFechaHoraBogota(r.startsAt);
    porDia.set(fecha, [...(porDia.get(fecha) ?? []), r]);
  }

  return (
    <ol className="flex flex-col gap-4">
      {Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)).map((fecha) => {
        const delDia = porDia.get(fecha) ?? [];
        const activas = delDia.filter((r) => r.status !== "cancelada");
        return (
          <li key={fecha} className="rounded-xl border border-neutral-200">
            <h2 className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 p-3 font-bold">
              <Link
                href={`/${tenant.slug}/admin?vista=dia&fecha=${fecha}`}
                className="text-primario underline underline-offset-4"
              >
                {formatearFechaLarga(fecha)}
              </Link>
              <span className="text-sm font-normal text-neutral-700">
                {activas.length} cita{activas.length === 1 ? "" : "s"}
              </span>
            </h2>
            {delDia.length === 0 ? (
              <p className="p-3 text-sm text-neutral-600">Sin citas.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {delDia.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/${tenant.slug}/admin?vista=dia&fecha=${fecha}&cita=${r.id}`}
                      className={`flex items-center justify-between gap-3 p-3 ${
                        r.status === "cancelada" ? "text-neutral-500 line-through" : ""
                      }`}
                    >
                      <span>
                        <span className="block font-semibold">
                          {formatearHora(aFechaHoraBogota(r.startsAt).hora)} · {r.customerName}
                        </span>
                        <span className="block text-sm">
                          {nombreServicio.get(r.serviceId) ?? r.serviceId} ·{" "}
                          {nombreProfesional.get(r.professionalId) ?? r.professionalId}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-800 no-underline">
                        {ETIQUETA_ESTADO[r.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
