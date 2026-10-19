"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { obtenerTenant } from "@/lib/tenants/obtener";
import { seleccionSchema } from "@/lib/validacion";
import {
  cancelarReserva,
  horariosParaReprogramar,
  reprogramarReserva,
  type FalloGestion,
} from "@/server/reservas/gestion";
import { mensajeDeGestion, MENSAJE_ERROR_GENERICO } from "@/server/reservas/mensajes";
import { crearRepositorio } from "@/server/reservas/repositorio";

// Endpoints públicos protegidos por el token secreto de la cita: se valida todo igualmente.

const fechaSchema = seleccionSchema.shape.fecha;
const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export type RespuestaGestion = { ok: true } | { ok: false; mensaje: string; codigo?: FalloGestion };

export type RespuestaHorariosCita =
  { ok: true; horarios: { hora: string }[] } | { ok: false; mensaje: string };

const NO_ENCONTRADA = "No encontramos esa cita.";

export async function cancelarCitaAccion(slug: string, token: string): Promise<RespuestaGestion> {
  const tenant = obtenerTenant(slug);
  if (!tenant) return { ok: false, mensaje: NO_ENCONTRADA };
  try {
    const r = await cancelarReserva(crearRepositorio(getDb()), tenant, token, new Date());
    if (r.ok) return { ok: true };
    return {
      ok: false,
      codigo: r.codigo,
      mensaje: mensajeDeGestion(r.codigo, tenant.anticipacionMinHoras),
    };
  } catch (error) {
    console.error("Error cancelando la cita:", error);
    return { ok: false, mensaje: MENSAJE_ERROR_GENERICO };
  }
}

export async function horariosCitaAccion(
  slug: string,
  token: string,
  fecha: string,
): Promise<RespuestaHorariosCita> {
  const tenant = obtenerTenant(slug);
  const f = fechaSchema.safeParse(fecha);
  if (!tenant || !f.success) return { ok: false, mensaje: "Elige una fecha válida." };
  try {
    const r = await horariosParaReprogramar(
      crearRepositorio(getDb()),
      tenant,
      token,
      f.data,
      new Date(),
    );
    if (r.ok) return r;
    return { ok: false, mensaje: mensajeDeGestion(r.codigo, tenant.anticipacionMinHoras) };
  } catch (error) {
    console.error("Error consultando horarios para reprogramar:", error);
    return { ok: false, mensaje: "No pudimos cargar los horarios. Inténtalo de nuevo." };
  }
}

export async function reprogramarCitaAccion(
  slug: string,
  token: string,
  fecha: string,
  hora: string,
): Promise<RespuestaGestion> {
  const tenant = obtenerTenant(slug);
  const f = fechaSchema.safeParse(fecha);
  const h = horaSchema.safeParse(hora);
  if (!tenant || !f.success || !h.success) {
    return { ok: false, mensaje: "Elige un día y una hora válidos." };
  }
  try {
    const r = await reprogramarReserva(
      crearRepositorio(getDb()),
      tenant,
      token,
      f.data,
      h.data,
      new Date(),
    );
    if (r.ok) return { ok: true };
    return {
      ok: false,
      codigo: r.codigo,
      mensaje: mensajeDeGestion(r.codigo, tenant.anticipacionMinHoras),
    };
  } catch (error) {
    console.error("Error reprogramando la cita:", error);
    return { ok: false, mensaje: MENSAJE_ERROR_GENERICO };
  }
}
