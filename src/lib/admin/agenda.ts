import { diaDeSemana, limitesDelDia } from "@/lib/disponibilidad";
import type { Tenant } from "@/lib/tenants/schema";

export interface Intervalo {
  startsAt: Date;
  endsAt: Date;
}

const MS_MINUTO = 60_000;

function minutosDeHora(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos desde las 00:00 de Bogotá de `fecha`, acotado al día (0–1440). */
export function minutosDelDia(instante: Date, fecha: string): number {
  const { desde } = limitesDelDia(fecha);
  const min = (instante.getTime() - desde.getTime()) / MS_MINUTO;
  return Math.min(1440, Math.max(0, Math.round(min)));
}

/**
 * Franja que muestra la agenda de un día, en minutos desde las 00:00 y redondeada a horas
 * completas: el horario del local ampliado para que quepa cualquier cita o bloqueo fuera de él.
 * Devuelve `null` si el local cierra ese día y no hay nada que mostrar.
 */
export function rangoVisible(
  tenant: Tenant,
  fecha: string,
  elementos: readonly Intervalo[],
): { desdeMin: number; hastaMin: number } | null {
  const horario = tenant.horario[diaDeSemana(fecha)];
  let desde = horario ? minutosDeHora(horario[0]) : Number.POSITIVE_INFINITY;
  let hasta = horario ? minutosDeHora(horario[1]) : Number.NEGATIVE_INFINITY;

  for (const e of elementos) {
    desde = Math.min(desde, minutosDelDia(e.startsAt, fecha));
    hasta = Math.max(hasta, minutosDelDia(e.endsAt, fecha));
  }
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return null;
  return { desdeMin: Math.floor(desde / 60) * 60, hastaMin: Math.ceil(hasta / 60) * 60 };
}

/** Posición de un elemento dentro de la franja visible, en minutos (se multiplica por los píxeles por minuto). */
export function posicionEnAgenda(
  elemento: Intervalo,
  fecha: string,
  desdeMin: number,
): { topMin: number; altoMin: number } {
  const inicio = minutosDelDia(elemento.startsAt, fecha);
  const fin = minutosDelDia(elemento.endsAt, fecha);
  return { topMin: inicio - desdeMin, altoMin: Math.max(fin - inicio, 0) };
}

/** Marcas de hora (en minutos desde las 00:00) para dibujar las líneas de la agenda. */
export function marcasDeHora(desdeMin: number, hastaMin: number): number[] {
  const marcas: number[] = [];
  for (let m = desdeMin; m < hastaMin; m += 60) marcas.push(m);
  return marcas;
}
