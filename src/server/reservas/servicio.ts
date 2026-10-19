import { esTraslape } from "@/db/errores";
import {
  calcularHorarios,
  limitesDelDia,
  type BloqueoHorario,
  type Horario,
  type ReservaOcupada,
} from "@/lib/disponibilidad";
import type { Tenant } from "@/lib/tenants/schema";
import type { EntradaReserva, Seleccion } from "@/lib/validacion";

/** Lo que la lógica necesita de la base de datos. Se inyecta para poder probarla sin red. */
export interface RepoReservas {
  reservasDelDia(slug: string, desde: Date, hasta: Date): Promise<ReservaOcupada[]>;
  bloqueosDelDia(slug: string, desde: Date, hasta: Date): Promise<BloqueoHorario[]>;
  /** Reservas confirmadas y futuras de ese celular en ese negocio. */
  contarActivasFuturas(slug: string, celular: string, ahora: Date): Promise<number>;
  /** Reservas creadas desde esa IP (hash) desde `desde`, en cualquier negocio. */
  contarPorIpDesde(ipHash: string, desde: Date): Promise<number>;
  /** Debe lanzar el error de exclusión de Postgres (23P01) si el horario ya está tomado. */
  insertar(datos: NuevaReservaWeb): Promise<{ id: string }>;
}

export interface NuevaReservaWeb {
  tenantSlug: string;
  serviceId: string;
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  manageToken: string;
  customerIpHash: string | null;
}

export interface ContextoReserva {
  ahora: Date;
  ipHash: string | null;
  generarToken: () => string;
}

export interface ReservaCreada {
  id: string;
  manageToken: string;
  profesionalId: string;
  inicio: Date;
  fin: Date;
}

export type FalloReserva =
  "servicio_invalido" | "profesional_invalido" | "horario_ocupado" | "limite_celular" | "limite_ip";

export type ResultadoReserva =
  { ok: true; reserva: ReservaCreada } | { ok: false; codigo: FalloReserva };

/** Límites de protección. En modo demo son más holgados: el prospecto prueba varias veces. */
export function limitesDe(tenant: Tenant) {
  return tenant.demo
    ? { citasPendientesPorCelular: 10, reservasPorIpPorHora: 30 }
    : { citasPendientesPorCelular: 3, reservasPorIpPorHora: 10 };
}

const INTENTOS_POR_CARRERA = 3;
const UNA_HORA_MS = 60 * 60 * 1000;

function resolver(tenant: Tenant, seleccion: Pick<Seleccion, "servicioId" | "profesionalId">) {
  const servicio = tenant.servicios.find((s) => s.id === seleccion.servicioId);
  if (!servicio) return { ok: false as const, fallo: "servicio_invalido" as const };
  if (
    seleccion.profesionalId !== "cualquiera" &&
    !tenant.profesionales.some((p) => p.id === seleccion.profesionalId)
  ) {
    return { ok: false as const, fallo: "profesional_invalido" as const };
  }
  return { ok: true as const, servicio };
}

async function horariosLibres(
  repo: RepoReservas,
  tenant: Tenant,
  seleccion: Seleccion,
  servicio: Tenant["servicios"][number],
  ahora: Date,
): Promise<Horario[]> {
  const { desde, hasta } = limitesDelDia(seleccion.fecha);
  const [reservas, bloqueos] = await Promise.all([
    repo.reservasDelDia(tenant.slug, desde, hasta),
    repo.bloqueosDelDia(tenant.slug, desde, hasta),
  ]);
  return calcularHorarios(
    tenant,
    servicio,
    seleccion.profesionalId,
    seleccion.fecha,
    reservas,
    bloqueos,
    ahora,
  );
}

/** Horarios libres para la selección del cliente. */
export async function consultarHorarios(
  repo: RepoReservas,
  tenant: Tenant,
  seleccion: Seleccion,
  ahora: Date,
): Promise<{ ok: true; horarios: Horario[] } | { ok: false; codigo: FalloReserva }> {
  const r = resolver(tenant, seleccion);
  if (!r.ok) return { ok: false, codigo: r.fallo };
  return { ok: true, horarios: await horariosLibres(repo, tenant, seleccion, r.servicio, ahora) };
}

/**
 * Crea una reserva web. Nunca confía en lo que mostró el cliente: vuelve a calcular los horarios
 * libres y usa el profesional que resulte (con "cualquiera", el menos ocupado). Si dos personas
 * toman el mismo horario a la vez, la base de datos rechaza la segunda y aquí se reintenta con los
 * horarios actualizados (otro profesional puede estar libre) antes de rendirse.
 */
export async function crearReserva(
  repo: RepoReservas,
  tenant: Tenant,
  entrada: EntradaReserva,
  contexto: ContextoReserva,
): Promise<ResultadoReserva> {
  const r = resolver(tenant, entrada);
  if (!r.ok) return { ok: false, codigo: r.fallo };
  const { servicio } = r;
  const limites = limitesDe(tenant);

  if (
    (await repo.contarActivasFuturas(tenant.slug, entrada.celular, contexto.ahora)) >=
    limites.citasPendientesPorCelular
  ) {
    return { ok: false, codigo: "limite_celular" };
  }
  if (
    contexto.ipHash &&
    (await repo.contarPorIpDesde(
      contexto.ipHash,
      new Date(contexto.ahora.getTime() - UNA_HORA_MS),
    )) >= limites.reservasPorIpPorHora
  ) {
    return { ok: false, codigo: "limite_ip" };
  }

  for (let intento = 0; intento < INTENTOS_POR_CARRERA; intento++) {
    const libres = await horariosLibres(repo, tenant, entrada, servicio, contexto.ahora);
    const horario = libres.find((h) => h.hora === entrada.hora);
    if (!horario) return { ok: false, codigo: "horario_ocupado" };

    const manageToken = contexto.generarToken();
    try {
      const { id } = await repo.insertar({
        tenantSlug: tenant.slug,
        serviceId: servicio.id,
        professionalId: horario.profesionalId,
        startsAt: horario.inicio,
        endsAt: horario.fin,
        customerName: entrada.nombre,
        customerPhone: entrada.celular,
        customerEmail: entrada.correo ?? null,
        manageToken,
        customerIpHash: contexto.ipHash,
      });
      return {
        ok: true,
        reserva: {
          id,
          manageToken,
          profesionalId: horario.profesionalId,
          inicio: horario.inicio,
          fin: horario.fin,
        },
      };
    } catch (error) {
      if (!esTraslape(error)) throw error;
      // Alguien se nos adelantó: se vuelve a calcular con los datos actualizados.
    }
  }
  return { ok: false, codigo: "horario_ocupado" };
}
