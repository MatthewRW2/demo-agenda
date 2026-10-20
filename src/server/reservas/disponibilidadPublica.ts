import { calcularHorarios, hoyEnBogota, limitesDelDia, sumarDias } from "@/lib/disponibilidad";
import type { Tenant } from "@/lib/tenants/schema";
import type { RepoReservas } from "./servicio";

/** Un horario libre que se puede ofrecer con un toque: el servicio principal de ese profesional. */
export interface TurnoLibre {
  hora: string;
  servicioId: string;
  profesionalId: string;
}

export interface DisponibilidadPublica {
  /** Hoy en Bogotá (YYYY-MM-DD), para que el navegador sepa si "proximo" es de hoy. */
  fechaHoy: string;
  /** Primer día con turnos y hasta 4 horas distintas de ese día; `null` si no hay en la ventana reservable. */
  proximo: { fecha: string; turnos: TurnoLibre[] } | null;
  /** Por profesional: ¿le quedan turnos hoy? */
  hoy: Record<string, boolean>;
}

const MAX_TURNOS = 4;

/**
 * Qué turnos hay libres ahora mismo, calculado con el mismo motor que usa la reserva. Para cada
 * profesional se toma su primer servicio de la lista (el principal). Mira hoy y, si no queda nada,
 * los días siguientes de la ventana reservable, deteniéndose en el primero que tenga turnos.
 */
export async function disponibilidadPublica(
  repo: Pick<RepoReservas, "reservasDelDia" | "bloqueosDelDia">,
  tenant: Tenant,
  ahora: Date,
): Promise<DisponibilidadPublica> {
  const fechaHoy = hoyEnBogota(ahora);
  const hoy: Record<string, boolean> = Object.fromEntries(
    tenant.profesionales.map((p) => [p.id, false]),
  );
  const principal = new Map(
    tenant.profesionales.map((p) => [
      p.id,
      tenant.servicios.find((s) => p.servicios.includes(s.id)),
    ]),
  );

  for (let i = 0; i < tenant.diasReservables; i++) {
    const fecha = sumarDias(fechaHoy, i);
    const { desde, hasta } = limitesDelDia(fecha);
    const [reservas, bloqueos] = await Promise.all([
      repo.reservasDelDia(tenant.slug, desde, hasta),
      repo.bloqueosDelDia(tenant.slug, desde, hasta),
    ]);

    const porHora = new Map<string, TurnoLibre>();
    for (const p of tenant.profesionales) {
      const servicio = principal.get(p.id);
      if (!servicio) continue;
      const libres = calcularHorarios(tenant, servicio, p.id, fecha, reservas, bloqueos, ahora);
      if (i === 0) hoy[p.id] = libres.length > 0;
      for (const h of libres) {
        if (!porHora.has(h.hora)) {
          porHora.set(h.hora, { hora: h.hora, servicioId: servicio.id, profesionalId: p.id });
        }
      }
    }

    if (porHora.size > 0) {
      const turnos = [...porHora.values()]
        .sort((a, b) => a.hora.localeCompare(b.hora))
        .slice(0, MAX_TURNOS);
      return { fechaHoy, proximo: { fecha, turnos }, hoy };
    }
  }
  return { fechaHoy, proximo: null, hoy };
}
