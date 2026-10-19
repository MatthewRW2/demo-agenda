/** Luminancia relativa WCAG de un color #RRGGBB (0 = negro, 1 = blanco). */
export function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** Relación de contraste WCAG entre dos colores (1 a 21). AA exige 4.5 para texto normal. */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

const NEGRO = "#111111";
const BLANCO = "#ffffff";

/** Color de texto (casi negro o blanco) que más contrasta sobre un fondo. */
export function colorTextoSobre(fondo: string): string {
  return contraste(fondo, NEGRO) >= contraste(fondo, BLANCO) ? NEGRO : BLANCO;
}
