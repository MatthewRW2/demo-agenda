import { sumarDias } from "@/lib/disponibilidad";

/** Un parámetro de la URL puede llegar como lista; se toma el primero. */
export function unico(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Devuelve la fecha YYYY-MM-DD si es real (no 2030-02-31); si no, undefined. */
export function fechaValida(valor: string | undefined): string | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  try {
    return sumarDias(valor, 0) === valor ? valor : undefined;
  } catch {
    return undefined;
  }
}
