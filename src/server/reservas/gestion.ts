import { esTraslape } from "@/db/errores";
import type { Booking } from "@/db/schema";
import { aFechaHoraBogota } from "@/lib/fechas";
import type { Tenant } from "@/lib/tenants/schema";
import { horariosLibres, type RepoReservas } from "./servicio";

export type ReservaGestionable = Pick<
  Booking,
  "id" | "serviceId" | "professionalId" | "startsAt" | "endsAt" | "status"
>;

/** Lo que la gestión de una cita necesita de la base de datos, además de lo de reservar. */
export interface RepoGestion extends RepoReservas {
  buscarPorToken(slug: string, token: string): Promise<ReservaGestionable | null>;
  /** Cancela solo si sigue confirmada. Devuelve false si ya no lo estaba. */
  cancelar(id: string): Promise<boolean>;
  /**
   * Mueve solo si sigue confirmada y borra la marca de recordatorio enviado. Devuelve false si ya
   * no estaba confirmada. Lanza el error de exclusión de Postgres (23P01) si el horario está tomado.
   */
  reprogramar(id: string, inicio: Date, fin: Date): Promise<boolean>;
}

export type MotivoNoGestionable = "no_activa" | "pasada" | "muy_cerca";

/**
 * ¿Puede el cliente cancelar o cambiar esta cita? Solo si sigue confirmada y falta al menos la
 * anticipación mínima del negocio (la misma regla que para reservar).
 */
export function evaluarGestion(
  tenant: Tenant,
  reserva: Pick<ReservaGestionable, "startsAt" | "status">,
  ahora: Date,
): { ok: true } | { ok: false; motivo: MotivoNoGestionable } {
  if (reserva.status !== "confirmada") return { ok: false, motivo: "no_activa" };
  if (reserva.startsAt <= ahora) return { ok: false, motivo: "pasada" };
  const limite = reserva.startsAt.getTime() - tenant.anticipacionMinHoras * 60 * 60 * 1000;
  if (ahora.getTime() > limite) return { ok: false, motivo: "muy_cerca" };
  return { ok: true };
}

export type FalloGestion =
  "no_encontrada" | MotivoNoGestionable | "horario_ocupado" | "sin_cambios";

async function cargarGestionable(
  repo: RepoGestion,
  tenant: Tenant,
  token: string,
  ahora: Date,
): Promise<{ ok: true; reserva: ReservaGestionable } | { ok: false; codigo: FalloGestion }> {
  const reserva = await repo.buscarPorToken(tenant.slug, token);
  if (!reserva) return { ok: false, codigo: "no_encontrada" };
  const permiso = evaluarGestion(tenant, reserva, ahora);
  if (!permiso.ok) return { ok: false, codigo: permiso.motivo };
  return { ok: true, reserva };
}

export async function cancelarReserva(
  repo: RepoGestion,
  tenant: Tenant,
  token: string,
  ahora: Date,
): Promise<{ ok: true } | { ok: false; codigo: FalloGestion }> {
  const r = await cargarGestionable(repo, tenant, token, ahora);
  if (!r.ok) return r;
  // Si otra pestaña ya la canceló, `cancelar` devuelve false y se informa igual.
  return (await repo.cancelar(r.reserva.id)) ? { ok: true } : { ok: false, codigo: "no_activa" };
}

/** Horarios libres de un día para mover esta cita (mismo servicio y profesional; su propio hueco cuenta como libre). */
export async function horariosParaReprogramar(
  repo: RepoGestion,
  tenant: Tenant,
  token: string,
  fecha: string,
  ahora: Date,
): Promise<{ ok: true; horarios: { hora: string }[] } | { ok: false; codigo: FalloGestion }> {
  const r = await cargarGestionable(repo, tenant, token, ahora);
  if (!r.ok) return r;
  const servicio = tenant.servicios.find((s) => s.id === r.reserva.serviceId);
  if (!servicio) return { ok: false, codigo: "no_encontrada" };

  const libres = await horariosLibres(
    repo,
    tenant,
    { servicioId: servicio.id, profesionalId: r.reserva.professionalId, fecha },
    servicio,
    ahora,
    r.reserva.id,
  );
  return { ok: true, horarios: libres.map((h) => ({ hora: h.hora })) };
}

export async function reprogramarReserva(
  repo: RepoGestion,
  tenant: Tenant,
  token: string,
  fecha: string,
  hora: string,
  ahora: Date,
): Promise<{ ok: true; inicio: Date } | { ok: false; codigo: FalloGestion }> {
  const r = await cargarGestionable(repo, tenant, token, ahora);
  if (!r.ok) return r;
  const { reserva } = r;
  const servicio = tenant.servicios.find((s) => s.id === reserva.serviceId);
  if (!servicio) return { ok: false, codigo: "no_encontrada" };

  const actual = aFechaHoraBogota(reserva.startsAt);
  if (actual.fecha === fecha && actual.hora === hora) return { ok: false, codigo: "sin_cambios" };

  // Se recalcula en el servidor: nunca se confía en lo que el cliente vio.
  const libres = await horariosLibres(
    repo,
    tenant,
    { servicioId: servicio.id, profesionalId: reserva.professionalId, fecha },
    servicio,
    ahora,
    reserva.id,
  );
  const nuevo = libres.find((h) => h.hora === hora);
  if (!nuevo) return { ok: false, codigo: "horario_ocupado" };

  try {
    const movida = await repo.reprogramar(reserva.id, nuevo.inicio, nuevo.fin);
    return movida ? { ok: true, inicio: nuevo.inicio } : { ok: false, codigo: "no_activa" };
  } catch (error) {
    if (esTraslape(error)) return { ok: false, codigo: "horario_ocupado" };
    throw error;
  }
}
