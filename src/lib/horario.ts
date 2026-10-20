import { DIAS, type Dia, type Tenant } from "@/lib/tenants/schema";
import { aFechaHoraBogota } from "@/lib/fechas";
import { diaDeSemana, hoyEnBogota, sumarDias } from "@/lib/disponibilidad";
import { NOMBRE_DIA, formatearHora } from "@/lib/texto";

type Horario = Tenant["horario"];

const ABREVIATURA: Record<Dia, string> = {
  lun: "Lun",
  mar: "Mar",
  mie: "Mié",
  jue: "Jue",
  vie: "Vie",
  sab: "Sáb",
  dom: "Dom",
};

export interface GrupoHorario {
  /** "Lun–Jue", "Vie" o "Sáb–Dom". */
  dias: string;
  /** "9:00 a. m.–7:00 p. m." o `null` si esos días el negocio está cerrado. */
  horas: string | null;
}

function textoRango(rango: readonly [string, string] | null): string | null {
  return rango ? `${formatearHora(rango[0])}–${formatearHora(rango[1])}` : null;
}

/** Junta los días consecutivos con el mismo horario: lunes a jueves iguales salen como "Lun–Jue". */
export function agruparHorario(horario: Horario): GrupoHorario[] {
  const grupos: { desde: Dia; hasta: Dia; horas: string | null }[] = [];
  for (const dia of DIAS) {
    const horas = textoRango(horario[dia]);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.horas === horas) ultimo.hasta = dia;
    else grupos.push({ desde: dia, hasta: dia, horas });
  }
  return grupos.map((g) => ({
    dias:
      g.desde === g.hasta
        ? ABREVIATURA[g.desde]
        : `${ABREVIATURA[g.desde]}–${ABREVIATURA[g.hasta]}`,
    horas: g.horas,
  }));
}

export type EstadoApertura =
  | { estado: "abierto"; cierra: string }
  | {
      estado: "cerrado";
      /** Próxima apertura, o `null` si el negocio no abre ningún día. */
      abre: { cuando: "hoy" | "manana" | Dia; hora: string } | null;
    };

const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** ¿El negocio está abierto en este instante (hora de Bogotá)? Si no, ¿cuándo abre? */
export function estadoApertura(tenant: Pick<Tenant, "horario">, ahora: Date): EstadoApertura {
  const { hora } = aFechaHoraBogota(ahora);
  const minutos = aMinutos(hora);
  const hoy = hoyEnBogota(ahora);
  const rangoHoy = tenant.horario[diaDeSemana(hoy)];

  if (rangoHoy && minutos >= aMinutos(rangoHoy[0]) && minutos < aMinutos(rangoHoy[1])) {
    return { estado: "abierto", cierra: rangoHoy[1] };
  }
  if (rangoHoy && minutos < aMinutos(rangoHoy[0])) {
    return { estado: "cerrado", abre: { cuando: "hoy", hora: rangoHoy[0] } };
  }
  for (let i = 1; i <= 7; i++) {
    const dia = diaDeSemana(sumarDias(hoy, i));
    const rango = tenant.horario[dia];
    if (rango)
      return { estado: "cerrado", abre: { cuando: i === 1 ? "manana" : dia, hora: rango[0] } };
  }
  return { estado: "cerrado", abre: null };
}

/** Frase para el chip del encabezado: "Abierto ahora · cierra 7:00 p. m." */
export function textoApertura(e: EstadoApertura): string {
  if (e.estado === "abierto") return `Abierto ahora · cierra ${formatearHora(e.cierra)}`;
  if (!e.abre) return "Cerrado";
  const cuando =
    e.abre.cuando === "hoy"
      ? "hoy"
      : e.abre.cuando === "manana"
        ? "mañana"
        : `el ${NOMBRE_DIA[e.abre.cuando].toLowerCase()}`;
  return `Cerrado · abre ${cuando} ${formatearHora(e.abre.hora)}`;
}
