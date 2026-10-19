import type { Dia } from "@/lib/tenants/schema";

export const NOMBRE_DIA: Record<Dia, string> = {
  lun: "Lunes",
  mar: "Martes",
  mie: "Miércoles",
  jue: "Jueves",
  vie: "Viernes",
  sab: "Sábado",
  dom: "Domingo",
};

export function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("es-CO") + texto.slice(1);
}

/** Plural sencillo del español: "barbero" -> "barberos", "doctor" -> "doctores". */
export function pluralizar(palabra: string): string {
  if (/[aeiouáéíóú]$/i.test(palabra)) return `${palabra}s`;
  if (/s$/i.test(palabra)) return palabra;
  if (/z$/i.test(palabra)) return `${palabra.slice(0, -1)}ces`;
  return `${palabra}es`;
}

/** "13:05" -> "1:05 p. m." (formato de 12 horas usual en Colombia). */
export function formatearHora(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const sufijo = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** "9:00" -> "9 a. m." (sin minutos si es en punto), para etiquetas angostas como las de la agenda. */
export function formatearHoraCorta(hhmm: string): string {
  const completa = formatearHora(hhmm);
  return completa.replace(":00 ", " ");
}

export function formatearDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Palabras que no aportan a las iniciales de un nombre: conectores y títulos ("Dra. Laura Mejía" -> "LM").
const PALABRAS_SIN_INICIAL = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "&",
  "dr",
  "dr.",
  "dra",
  "dra.",
  "sr",
  "sr.",
  "sra",
  "sra.",
]);

/** Hasta dos iniciales de un nombre, ignorando conectores y títulos: "Spa de la Luna" -> "SL". */
export function iniciales(nombre: string): string {
  const palabras = nombre
    .split(/\s+/)
    .filter((p) => p && !PALABRAS_SIN_INICIAL.has(p.toLowerCase()));
  const letras = palabras.slice(0, 2).map((p) => Array.from(p)[0]);
  return letras.join("").toLocaleUpperCase("es-CO") || "?";
}
