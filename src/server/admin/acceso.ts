import { cookies } from "next/headers";
import { nombreCookie, verificarTokenSesion } from "./sesion";

export type Acceso = "ok" | "sin_config" | "sin_sesion";

/** Contraseña del panel. Si no está configurada, el panel queda cerrado para todos. */
export function contrasenaDelPanel(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

/**
 * ¿Quién llama puede usar el panel de este negocio? Se comprueba en cada página y en cada acción
 * del servidor: un layout no protege las acciones, que son endpoints públicos.
 */
export async function comprobarAcceso(slug: string): Promise<Acceso> {
  const password = contrasenaDelPanel();
  if (!password) return "sin_config";
  const token = (await cookies()).get(nombreCookie(slug))?.value;
  return verificarTokenSesion(token, slug, password, new Date()) ? "ok" : "sin_sesion";
}
