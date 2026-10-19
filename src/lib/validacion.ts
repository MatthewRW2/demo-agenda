import { z } from "zod";

/**
 * Celular colombiano: 10 dígitos que empiezan por 3. Acepta espacios, guiones, paréntesis y el
 * prefijo +57 / 57 / 0057. Devuelve los 10 dígitos, o null si no es un celular válido.
 */
export function normalizarCelular(entrada: string): string | null {
  let digitos = entrada.replace(/[\s\-().]/g, "");
  if (digitos.startsWith("+")) digitos = digitos.slice(1);
  if (!/^\d+$/.test(digitos)) return null;
  if (digitos.startsWith("0057")) digitos = digitos.slice(4);
  else if (digitos.length === 12 && digitos.startsWith("57")) digitos = digitos.slice(2);
  return /^3\d{9}$/.test(digitos) ? digitos : null;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const celular = z.string({ error: "Escribe tu número de celular." }).transform((valor, ctx) => {
  const normalizado = normalizarCelular(valor);
  if (!normalizado) {
    ctx.addIssue({
      code: "custom",
      message: "Escribe un celular colombiano de 10 dígitos (ej. 300 123 4567).",
    });
    return z.NEVER;
  }
  return normalizado;
});

const correoOpcional = z
  .string()
  .trim()
  .max(120, "El correo es demasiado largo.")
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.email("Escribe un correo válido o déjalo en blanco.").optional());

/** La selección de servicio, profesional y horario (sirve para consultar y para reservar). */
export const seleccionSchema = z.object({
  servicioId: z.string().min(1).max(60),
  /** Id de un profesional o "cualquiera". */
  profesionalId: z.string().min(1).max(60),
  fecha: z.string().regex(FECHA, "Fecha inválida."),
});

export const reservaSchema = seleccionSchema.extend({
  hora: z.string().regex(HORA, "Hora inválida."),
  nombre: z
    .string({ error: "Escribe tu nombre." })
    .trim()
    .min(2, "Escribe tu nombre.")
    .max(80, "El nombre es demasiado largo."),
  celular,
  correo: correoOpcional,
});

export type Seleccion = z.infer<typeof seleccionSchema>;
export type EntradaReserva = z.infer<typeof reservaSchema>;

/** Primer mensaje de error por campo, para mostrarlo junto a cada campo del formulario. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? "general");
    errores[campo] ??= issue.message;
  }
  return errores;
}
