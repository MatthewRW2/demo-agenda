import { TZDate } from "@date-fns/tz";
import { diaDeSemana, ZONA_HORARIA } from "@/lib/disponibilidad";
import { NOMBRE_DIA, formatearHora } from "@/lib/texto";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function partes(fecha: string): [number, number, number] {
  const [a, m, d] = fecha.split("-").map(Number);
  return [a, m, d];
}

/** "2030-03-04" -> "lunes 4 de marzo" */
export function formatearFechaLarga(fecha: string): string {
  const [, mes, dia] = partes(fecha);
  return `${NOMBRE_DIA[diaDeSemana(fecha)].toLowerCase()} ${dia} de ${MESES[mes - 1]}`;
}

/** "2030-03-04" -> { diaSemana: "Lun", dia: 4, mes: "mar" } (para el carrusel de días) */
export function formatearFechaCorta(fecha: string) {
  const [, mes, dia] = partes(fecha);
  return {
    diaSemana: NOMBRE_DIA[diaDeSemana(fecha)].slice(0, 3),
    dia,
    mes: MESES[mes - 1].slice(0, 3),
  };
}

/** Fecha y hora (en Bogotá) de un instante: { fecha: "2030-03-04", hora: "15:00" } */
export function aFechaHoraBogota(instante: Date): { fecha: string; hora: string } {
  const t = new TZDate(instante, ZONA_HORARIA);
  const dos = (n: number) => String(n).padStart(2, "0");
  return {
    fecha: `${t.getFullYear()}-${dos(t.getMonth() + 1)}-${dos(t.getDate())}`,
    hora: `${dos(t.getHours())}:${dos(t.getMinutes())}`,
  };
}

/** "lunes 4 de marzo, 3:00 p. m." (hora de Bogotá) */
export function formatearFechaHora(instante: Date): string {
  const { fecha, hora } = aFechaHoraBogota(instante);
  return `${formatearFechaLarga(fecha)}, ${formatearHora(hora)}`;
}
