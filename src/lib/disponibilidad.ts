import { TZDate } from "@date-fns/tz";
import { DIAS, type Dia, type Servicio, type Tenant } from "@/lib/tenants/schema";

export const ZONA_HORARIA = "America/Bogota";

/** Una reserva existente. Las canceladas se ignoran. Solo se pasan las del negocio consultado. */
export interface ReservaOcupada {
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  status?: string;
}

/** Un bloqueo. `professionalId: null` bloquea todo el local. */
export interface BloqueoHorario {
  professionalId: string | null;
  startsAt: Date;
  endsAt: Date;
}

/** Un horario libre. `hora` es la hora de inicio en Bogotá ("HH:MM"). */
export interface Horario {
  hora: string;
  inicio: Date;
  fin: Date;
  /** Con "cualquiera", el profesional asignado (el menos ocupado ese día). */
  profesionalId: string;
}

const MS_MINUTO = 60_000;
const FECHA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

function partesDeFecha(fecha: string): [number, number, number] {
  const m = FECHA_REGEX.exec(fecha);
  if (!m) throw new Error(`Fecha inválida "${fecha}": se espera YYYY-MM-DD.`);
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Date.UTC "arregla" fechas imposibles como 2030-02-31; aquí se rechazan.
  const control = new Date(Date.UTC(anio, mes - 1, dia));
  if (control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== dia) {
    throw new Error(`Fecha inválida "${fecha}": ese día no existe.`);
  }
  return [anio, mes, dia];
}

function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Fecha (YYYY-MM-DD) que marca el reloj de Bogotá en el instante `instante`. */
export function hoyEnBogota(instante: Date): string {
  const t = new TZDate(instante, ZONA_HORARIA);
  return formatearFecha(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

function formatearFecha(anio: number, mes: number, dia: number): string {
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Suma días a una fecha YYYY-MM-DD (aritmética de calendario, sin zonas horarias). */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = partesDeFecha(fecha);
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return formatearFecha(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Clave del día de la semana (lun…dom) de una fecha YYYY-MM-DD. */
export function diaDeSemana(fecha: string): Dia {
  const [anio, mes, dia] = partesDeFecha(fecha);
  const d = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(); // 0 = domingo
  return DIAS[(d + 6) % 7];
}

/** Instante UTC de una hora de pared en Bogotá. */
function instanteBogota(fecha: string, minutosDelDia: number): Date {
  const [anio, mes, dia] = partesDeFecha(fecha);
  const t = new TZDate(
    anio,
    mes - 1,
    dia,
    Math.floor(minutosDelDia / 60),
    minutosDelDia % 60,
    0,
    ZONA_HORARIA,
  );
  return new Date(t.getTime());
}

function horaDeMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** Todas las fechas reservables (hoy y los siguientes `diasReservables - 1` días) en que el local abre. */
export function diasDisponibles(tenant: Tenant, ahora: Date): string[] {
  const hoy = hoyEnBogota(ahora);
  const fechas: string[] = [];
  for (let i = 0; i < tenant.diasReservables; i++) {
    const fecha = sumarDias(hoy, i);
    if (tenant.horario[diaDeSemana(fecha)]) fechas.push(fecha);
  }
  return fechas;
}

function seTraslapan(aIni: number, aFin: number, bIni: number, bFin: number): boolean {
  return aIni < bFin && bIni < aFin;
}

/**
 * Horarios libres de un servicio en un día.
 *
 * - `fecha`: día del calendario de Bogotá, "YYYY-MM-DD".
 * - `profesional`: id concreto, o `"cualquiera"` para unir a quienes hacen ese servicio.
 * - `reservas` / `bloqueos`: los existentes del negocio (las reservas canceladas no cuentan).
 * - `ahora`: instante actual, inyectado para poder probar.
 *
 * Reglas: horario del local, duración del servicio, intervalo entre inicios, anticipación mínima,
 * ventana de días reservables (hoy + `diasReservables - 1`), reservas y bloqueos. Un horario es
 * libre si [inicio, fin) no se solapa con nada; terminar justo cuando empieza otra cita es válido.
 */
export function calcularHorarios(
  tenant: Tenant,
  servicio: Servicio,
  profesional: string | "cualquiera",
  fecha: string,
  reservas: readonly ReservaOcupada[],
  bloqueos: readonly BloqueoHorario[],
  ahora: Date,
): Horario[] {
  partesDeFecha(fecha); // valida el formato aunque luego se devuelva vacío

  const hoy = hoyEnBogota(ahora);
  const ultimoDia = sumarDias(hoy, tenant.diasReservables - 1);
  if (fecha < hoy || fecha > ultimoDia) return [];

  const rango = tenant.horario[diaDeSemana(fecha)];
  if (!rango) return [];
  const apertura = minutosDeHora(rango[0]);
  const cierre = minutosDeHora(rango[1]);

  const candidatos = tenant.profesionales.filter(
    (p) =>
      p.servicios.includes(servicio.id) && (profesional === "cualquiera" || p.id === profesional),
  );
  if (candidatos.length === 0) return [];

  const activas = reservas
    .filter((r) => r.status !== "cancelada")
    .map((r) => ({ id: r.professionalId, ini: r.startsAt.getTime(), fin: r.endsAt.getTime() }));
  const bloqueadas = bloqueos.map((b) => ({
    id: b.professionalId,
    ini: b.startsAt.getTime(),
    fin: b.endsAt.getTime(),
  }));

  // Carga del día por profesional (minutos reservados): para elegir al menos ocupado.
  const diaIni = instanteBogota(fecha, 0).getTime();
  const diaFin = instanteBogota(sumarDias(fecha, 1), 0).getTime();
  const carga = new Map<string, number>();
  for (const r of activas) {
    if (!seTraslapan(r.ini, r.fin, diaIni, diaFin)) continue;
    carga.set(r.id, (carga.get(r.id) ?? 0) + (r.fin - r.ini) / MS_MINUTO);
  }

  const minimo = ahora.getTime() + tenant.anticipacionMinHoras * 60 * MS_MINUTO;
  const horarios: Horario[] = [];

  for (
    let inicioMin = apertura;
    inicioMin + servicio.duracionMin <= cierre;
    inicioMin += tenant.intervaloMin
  ) {
    const inicio = instanteBogota(fecha, inicioMin).getTime();
    const fin = inicio + servicio.duracionMin * MS_MINUTO;
    if (inicio < minimo) continue;

    const libres = candidatos.filter(
      (p) =>
        !activas.some((r) => r.id === p.id && seTraslapan(inicio, fin, r.ini, r.fin)) &&
        !bloqueadas.some(
          (b) => (b.id === null || b.id === p.id) && seTraslapan(inicio, fin, b.ini, b.fin),
        ),
    );
    if (libres.length === 0) continue;

    // Menos ocupado primero; si empatan, gana el que aparece antes en el JSON.
    const elegido = libres.reduce((mejor, p) =>
      (carga.get(p.id) ?? 0) < (carga.get(mejor.id) ?? 0) ? p : mejor,
    );

    horarios.push({
      hora: horaDeMinutos(inicioMin),
      inicio: new Date(inicio),
      fin: new Date(fin),
      profesionalId: elegido.id,
    });
  }

  return horarios;
}
