"use server";

import { cookies } from "next/headers";
import { getDb } from "@/db";
import { ESTADOS_RESERVA } from "@/db/schema";
import { seleccionSchema } from "@/lib/validacion";
import { obtenerTenant } from "@/lib/tenants/obtener";
import { comprobarAcceso, contrasenaDelPanel } from "@/server/admin/acceso";
import {
  borrarBloqueo,
  cambiarEstado,
  crearBloqueo,
  crearCitaAdmin,
  horariosParaAdmin,
  marcarRecordatorio,
  type EstadoReserva,
} from "@/server/admin/operaciones";
import {
  DURACION_SESION_S,
  contrasenaCorrecta,
  crearTokenSesion,
  nombreCookie,
} from "@/server/admin/sesion";
import { MENSAJE_HORARIO_OCUPADO } from "@/db/errores";
import { sembrarDemo } from "@/server/demo/sembrar";

// Endpoints públicos: cada uno comprueba la sesión del negocio antes de hacer nada.

const SESION_TERMINADA = "Tu sesión terminó. Vuelve a entrar.";
const ERROR_GENERICO = "No pudimos completar la acción. Inténtalo de nuevo.";

export type Respuesta<T = object> =
  ({ ok: true } & T) | { ok: false; mensaje: string; errores?: Record<string, string> };

function rutaCookie(slug: string) {
  return `/${slug}/admin`;
}

export async function iniciarSesionAccion(slug: string, contrasena: string): Promise<Respuesta> {
  if (!obtenerTenant(slug)) return { ok: false, mensaje: "No encontramos ese negocio." };
  const esperada = contrasenaDelPanel();
  if (!esperada) return { ok: false, mensaje: "El panel todavía no está configurado." };

  if (typeof contrasena !== "string" || !contrasenaCorrecta(contrasena, esperada)) {
    // Pequeña demora uniforme: encarece adivinar la contraseña a base de intentos.
    await new Promise((r) => setTimeout(r, 700));
    return { ok: false, mensaje: "Contraseña incorrecta." };
  }

  (await cookies()).set(nombreCookie(slug), crearTokenSesion(slug, esperada, new Date()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: rutaCookie(slug),
    maxAge: DURACION_SESION_S,
  });
  return { ok: true };
}

export async function cerrarSesionAccion(slug: string): Promise<Respuesta> {
  (await cookies()).set(nombreCookie(slug), "", { path: rutaCookie(slug), maxAge: 0 });
  return { ok: true };
}

/** Resuelve el negocio y exige sesión; si algo falla devuelve el mensaje listo para mostrar. */
async function contexto(slug: string) {
  const tenant = obtenerTenant(slug);
  if (!tenant) return { ok: false, error: "No encontramos ese negocio." } as const;
  if ((await comprobarAcceso(slug)) !== "ok")
    return { ok: false, error: SESION_TERMINADA } as const;
  return { ok: true, tenant } as const;
}

export async function cambiarEstadoAccion(
  slug: string,
  id: string,
  estado: string,
): Promise<Respuesta> {
  const c = await contexto(slug);
  if (!c.ok) return { ok: false, mensaje: c.error };
  if (!ESTADOS_RESERVA.includes(estado as EstadoReserva)) {
    return { ok: false, mensaje: "Estado inválido." };
  }
  try {
    const r = await cambiarEstado(getDb(), slug, id, estado as EstadoReserva);
    if (r === "ok") return { ok: true };
    if (r === "horario_ocupado") {
      return { ok: false, mensaje: `${MENSAJE_HORARIO_OCUPADO} No se puede reactivar esta cita.` };
    }
    return { ok: false, mensaje: "No encontramos esa cita." };
  } catch (error) {
    console.error("Error cambiando el estado:", error);
    return { ok: false, mensaje: ERROR_GENERICO };
  }
}

export async function horariosAdminAccion(
  slug: string,
  seleccion: unknown,
): Promise<Respuesta<{ horarios: { hora: string; profesionalId: string }[] }>> {
  const c = await contexto(slug);
  if (!c.ok) return { ok: false, mensaje: c.error };
  const s = seleccionSchema.safeParse(seleccion);
  if (!s.success) return { ok: false, mensaje: "Elige un servicio, un profesional y una fecha." };
  try {
    const horarios = await horariosParaAdmin(getDb(), c.tenant, s.data);
    if (!horarios) return { ok: false, mensaje: "Servicio o profesional inexistente." };
    return { ok: true, horarios };
  } catch (error) {
    console.error("Error consultando horarios del panel:", error);
    return { ok: false, mensaje: "No pudimos cargar los horarios." };
  }
}

export async function crearCitaAdminAccion(slug: string, datos: unknown): Promise<Respuesta> {
  const c = await contexto(slug);
  if (!c.ok) return { ok: false, mensaje: c.error };
  try {
    const r = await crearCitaAdmin(getDb(), c.tenant, datos);
    if (r.ok) return { ok: true };
    if (r.codigo === "horario_ocupado") return { ok: false, mensaje: MENSAJE_HORARIO_OCUPADO };
    return { ok: false, mensaje: "Revisa los datos marcados.", errores: r.errores };
  } catch (error) {
    console.error("Error creando la cita manual:", error);
    return { ok: false, mensaje: ERROR_GENERICO };
  }
}

export async function crearBloqueoAccion(
  slug: string,
  datos: unknown,
): Promise<Respuesta<{ citasAfectadas: number }>> {
  const c = await contexto(slug);
  if (!c.ok) return { ok: false, mensaje: c.error };
  try {
    const r = await crearBloqueo(getDb(), c.tenant, datos);
    if (r.ok) return { ok: true, citasAfectadas: r.citasAfectadas };
    return { ok: false, mensaje: "Revisa los datos marcados.", errores: r.errores };
  } catch (error) {
    console.error("Error creando el bloqueo:", error);
    return { ok: false, mensaje: ERROR_GENERICO };
  }
}

export async function borrarBloqueoAccion(slug: string, id: string): Promise<Respuesta> {
  const c = await contexto(slug);
  if (!c.ok) return { ok: false, mensaje: c.error };
  try {
    return (await borrarBloqueo(getDb(), slug, id))
      ? { ok: true }
      : { ok: false, mensaje: "Ese bloqueo ya no existe." };
  } catch (error) {
    console.error("Error borrando el bloqueo:", error);
    return { ok: false, mensaje: ERROR_GENERICO };
  }
}

export async function marcarRecordatorioAccion(slug: string, id: string): Promise<Respuesta> {
  const c = await contexto(slug);
  if (!c.ok) return { ok: false, mensaje: c.error };
  try {
    return (await marcarRecordatorio(getDb(), slug, id, new Date()))
      ? { ok: true }
      : { ok: false, mensaje: "No encontramos esa cita." };
  } catch (error) {
    console.error("Error marcando el recordatorio:", error);
    return { ok: false, mensaje: ERROR_GENERICO };
  }
}

/** Vuelve a sembrar los datos de ejemplo. Solo existe para negocios marcados como demo. */
export async function restablecerDemoAccion(
  slug: string,
): Promise<Respuesta<{ reservas: number; bloqueos: number }>> {
  const c = await contexto(slug);
  if (!c.ok) return { ok: false, mensaje: c.error };
  if (!c.tenant.demo) {
    return { ok: false, mensaje: "Este negocio no es una demo: sus datos no se restablecen." };
  }
  try {
    const r = await sembrarDemo(getDb(), c.tenant, new Date());
    return { ok: true, ...r };
  } catch (error) {
    console.error("Error restableciendo la demo:", error);
    return { ok: false, mensaje: "No pudimos restablecer la demo. Inténtalo de nuevo." };
  }
}
