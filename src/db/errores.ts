/** Código de Postgres para "exclusion_violation": dos filas que no pueden coexistir. */
const EXCLUSION_VIOLATION = "23P01";

/** Mensaje amable para el cliente cuando el horario se ocupó justo antes de confirmar. */
export const MENSAJE_HORARIO_OCUPADO = "Ese horario se acaba de ocupar, elige otro.";

/**
 * ¿El error es un traslape rechazado por la base de datos? Drizzle envuelve el error original
 * en `cause`, así que se recorre la cadena.
 */
export function esTraslape(error: unknown): boolean {
  let actual: unknown = error;
  for (let i = 0; i < 5 && actual; i++) {
    if (typeof actual === "object" && (actual as { code?: unknown }).code === EXCLUSION_VIOLATION) {
      return true;
    }
    actual = (actual as { cause?: unknown }).cause;
  }
  return false;
}
