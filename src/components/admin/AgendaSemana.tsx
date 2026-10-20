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
          <li key={fecha} className="border-linea rounded-xl border">
            <h2 className="border-linea bg-papel flex items-center justify-between gap-2 border-b p-3 font-bold">
              <Link
                href={`/${tenant.slug}/admin?vista=dia&fecha=${fecha}`}
                className="text-primario-texto underline underline-offset-4"
              >
                {formatearFechaLarga(fecha)}
              </Link>
              <span className="text-tinta-suave text-sm font-normal">
                {activas.length} cita{activas.length === 1 ? "" : "s"}
              </span>
            </h2>
            {delDia.length === 0 ? (
              <p className="text-tinta-suave p-3 text-sm">Sin citas.</p>
            ) : (
              <ul className="divide-linea divide-y">
                {delDia.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/${tenant.slug}/admin?vista=dia&fecha=${fecha}&cita=${r.id}`}
                      className={`flex items-center justify-between gap-3 p-3 ${
                        r.status === "cancelada" ? "text-tinta-suave line-through" : ""
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
                      <span className="bg-papel-2 text-tinta shrink-0 rounded-full px-2 py-1 text-xs font-semibold no-underline">
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
