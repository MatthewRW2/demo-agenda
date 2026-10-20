export type Momento = "manana" | "tarde" | "noche";

export interface GrupoDeHoras {
  momento: Momento;
  titulo: string;
  horas: string[];
}

const TITULOS: Record<Momento, string> = { manana: "Mañana", tarde: "Tarde", noche: "Noche" };

function momentoDe(hora: string): Momento {
  const h = Number(hora.slice(0, 2));
  if (h < 12) return "manana";
  if (h < 18) return "tarde";
  return "noche";
}

/** Reparte horas "HH:mm" en mañana (antes de 12), tarde (12–17:59) y noche (desde 18); omite los grupos vacíos. */
export function agruparPorMomento(horas: string[]): GrupoDeHoras[] {
  const grupos: GrupoDeHoras[] = [];
  for (const momento of ["manana", "tarde", "noche"] as const) {
    const delGrupo = horas.filter((h) => momentoDe(h) === momento);
    if (delGrupo.length > 0) grupos.push({ momento, titulo: TITULOS[momento], horas: delGrupo });
  }
  return grupos;
}
