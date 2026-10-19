import { aFechaHoraBogota } from "@/lib/fechas";
import type { Tenant } from "@/lib/tenants/schema";

export interface ReservaMetrica {
  serviceId: string;
  startsAt: Date;
  status: string;
}

export interface Metricas {
  /** Citas no canceladas. */
  citas: number;
  canceladas: number;
  completadas: number;
  inasistencias: number;
  /** no_asistio / (completada + no_asistio), de 0 a 100 con un decimal; null si aún no hay ninguna resuelta. */
  porcentajeInasistencias: number | null;
  /** Suma de precios de las citas confirmadas y completadas (no cuenta inasistencias ni canceladas). */
  ingresosEstimados: number;
  servicioMasPedido: { id: string; nombre: string; cantidad: number } | null;
  /** Hora del día (0-23, Bogotá) con más citas que empiezan en ella. */
  horaMasOcupada: { hora: number; cantidad: number } | null;
}

/**
 * Métricas de un conjunto de reservas (normalmente las de una semana). Desempates: el servicio que
 * aparece antes en el JSON y la hora más temprana.
 */
export function calcularMetricas(tenant: Tenant, reservas: readonly ReservaMetrica[]): Metricas {
  const precios = new Map(tenant.servicios.map((s) => [s.id, s.precio]));
  const nombres = new Map(tenant.servicios.map((s) => [s.id, s.nombre]));

  let canceladas = 0;
  let completadas = 0;
  let inasistencias = 0;
  let ingresos = 0;
  const porServicio = new Map<string, number>();
  const porHora = new Map<number, number>();

  for (const r of reservas) {
    if (r.status === "cancelada") {
      canceladas++;
      continue;
    }
    if (r.status === "completada") completadas++;
    if (r.status === "no_asistio") inasistencias++;
    if (r.status === "confirmada" || r.status === "completada") {
      ingresos += precios.get(r.serviceId) ?? 0;
    }
    porServicio.set(r.serviceId, (porServicio.get(r.serviceId) ?? 0) + 1);
    const hora = Number(aFechaHoraBogota(r.startsAt).hora.slice(0, 2));
    porHora.set(hora, (porHora.get(hora) ?? 0) + 1);
  }

  const citas = reservas.length - canceladas;
  const resueltas = completadas + inasistencias;

  // Para desempatar por orden del JSON se recorre primero lo conocido y después lo desconocido.
  const ordenServicios = [...porServicio.keys()].sort(
    (a, b) => indiceOInfinito(tenant, a) - indiceOInfinito(tenant, b),
  );
  let servicioMasPedido: Metricas["servicioMasPedido"] = null;
  for (const id of ordenServicios) {
    const cantidad = porServicio.get(id)!;
    if (!servicioMasPedido || cantidad > servicioMasPedido.cantidad) {
      servicioMasPedido = { id, nombre: nombres.get(id) ?? id, cantidad };
    }
  }

  let horaMasOcupada: Metricas["horaMasOcupada"] = null;
  for (const hora of [...porHora.keys()].sort((a, b) => a - b)) {
    const cantidad = porHora.get(hora)!;
    if (!horaMasOcupada || cantidad > horaMasOcupada.cantidad) horaMasOcupada = { hora, cantidad };
  }

  return {
    citas,
    canceladas,
    completadas,
    inasistencias,
    porcentajeInasistencias:
      resueltas === 0 ? null : Math.round((inasistencias / resueltas) * 1000) / 10,
    ingresosEstimados: ingresos,
    servicioMasPedido,
    horaMasOcupada,
  };
}

function indiceOInfinito(tenant: Tenant, id: string): number {
  const i = tenant.servicios.findIndex((s) => s.id === id);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}
