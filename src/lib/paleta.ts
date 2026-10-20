import { colorTextoSobre, contraste } from "./color";

/**
 * Paleta de superficies y textos derivada de los dos colores de un negocio. Sirve para que el diseño se
 * vea bien (y se lea bien) con CUALQUIER par de colores del JSON: los tonos de apoyo salen de mezclar el
 * primario y los textos se oscurecen solos hasta cumplir el contraste.
 */
export interface Paleta {
  /** Fondo claro de la página: blanco con un toque del primario. */
  papel: string;
  /** Superficie un paso más marcada (tarjetas, filas alternas). */
  papel2: string;
  /** Líneas y separadores decorativos. */
  linea: string;
  /** Borde de controles (campos, botones de borde): al menos 3:1 sobre el papel. */
  bordeControl: string;
  /** Texto principal: al menos 7:1 sobre el papel y sobre el papel2. */
  tinta: string;
  /** Texto secundario: al menos 4,5:1 sobre el papel y sobre el papel2. */
  tintaSuave: string;
  /** El primario usado como texto (precios, enlaces): al menos 4,5:1 sobre el papel. */
  primarioTexto: string;
}

// --- OKLab: mezclar en un espacio perceptual evita tonos sucios al aclarar u oscurecer ---------------

type Lab = [number, number, number];

function hexARgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const aLineal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const aGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function hexALab(hex: string): Lab {
  const [r, g, b] = hexARgb(hex).map(aLineal);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labAHex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lineal = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    lineal
      .map((c) => Math.round(Math.min(1, Math.max(0, aGamma(Math.min(1, Math.max(0, c))))) * 255))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Mezcla `a` y `b` en OKLab: t = 0 devuelve `a`, t = 1 devuelve `b`. */
export function mezclar(a: string, b: string, t: number): string {
  const [la, lb] = [hexALab(a), hexALab(b)];
  return labAHex([
    la[0] + (lb[0] - la[0]) * t,
    la[1] + (lb[1] - la[1]) * t,
    la[2] + (lb[2] - la[2]) * t,
  ]);
}

/** Oscurece `color` (hacia el negro) lo mínimo necesario para llegar al contraste pedido sobre todos los fondos. */
function oscurecerHasta(color: string, fondos: string[], minimo: number): string {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const candidato = mezclar(color, "#000000", Math.min(t, 1));
    if (fondos.every((f) => contraste(candidato, f) >= minimo)) return candidato;
  }
  return "#000000";
}

export function derivarPaleta(primario: string, acento: string): Paleta {
  void acento; // el acento se usa solo como relleno de botones; su texto se calcula con colorTextoSobre
  const papel = mezclar("#ffffff", primario, 0.05);
  const papel2 = mezclar("#ffffff", primario, 0.11);
  const fondos = [papel, papel2];

  const tinta = oscurecerHasta(mezclar(primario, "#000000", 0.35), fondos, 7);
  const tintaSuave = oscurecerHasta(mezclar(tinta, papel, 0.4), fondos, 4.5);
  const primarioTexto = oscurecerHasta(primario, fondos, 4.5);
  const linea = mezclar("#ffffff", primario, 0.2);
  const bordeControl = oscurecerHasta(mezclar("#ffffff", primario, 0.45), fondos, 3);

  return { papel, papel2, linea, bordeControl, tinta, tintaSuave, primarioTexto };
}

/** Todas las variables CSS de marca de un negocio (colores base, textos sobre ellos y paleta derivada). */
export function variablesDeMarca(colores: {
  primario: string;
  acento: string;
}): Record<string, string> {
  const p = derivarPaleta(colores.primario, colores.acento);
  return {
    "--primario": colores.primario,
    "--acento": colores.acento,
    "--sobre-primario": colorTextoSobre(colores.primario),
    "--sobre-acento": colorTextoSobre(colores.acento),
    "--papel": p.papel,
    "--papel-2": p.papel2,
    "--linea": p.linea,
    "--borde-control": p.bordeControl,
    "--tinta": p.tinta,
    "--tinta-suave": p.tintaSuave,
    "--primario-texto": p.primarioTexto,
  };
}
