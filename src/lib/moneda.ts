const formato = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Formatea un valor en pesos colombianos, p. ej. 25000 -> "$ 25.000". */
export function formatearCOP(valor: number): string {
  return formato.format(valor);
}
