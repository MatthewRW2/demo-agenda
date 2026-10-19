"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { getDb } from "@/db";
import { urlBase } from "@/lib/enlaces";
import { codigoReserva } from "@/lib/reserva";
import { obtenerTenant } from "@/lib/tenants/obtener";
import { erroresPorCampo, reservaSchema, seleccionSchema } from "@/lib/validacion";
import { enviarCorreo, plantillaConfirmacion, remitenteDe } from "@/server/correo";
import { mensajeDeFallo, MENSAJE_ERROR_GENERICO } from "@/server/reservas/mensajes";
import { crearRepositorio } from "@/server/reservas/repositorio";
import { consultarHorarios, crearReserva } from "@/server/reservas/servicio";

// Estas funciones son endpoints públicos: nada de lo que llega se da por bueno.

export type RespuestaHorarios =
  { ok: true; horarios: { hora: string }[] } | { ok: false; mensaje: string };

export type RespuestaReserva =
  | { ok: true; token: string }
  | {
      ok: false;
      mensaje: string;
      /** "horario_ocupado" hace que el cliente vuelva a elegir hora. */
      codigo?: "horario_ocupado";
      errores?: Record<string, string>;
    };

const NO_ENCONTRADO = "No encontramos ese negocio.";

/** IP de quien llama, convertida en un hash con sal: no se guarda la IP en claro. */
async function hashDeIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  if (!ip) return null;
  const sal = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || "demo-agenda";
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex");
}

export async function obtenerHorariosAccion(
  slug: string,
  seleccion: unknown,
): Promise<RespuestaHorarios> {
  const tenant = obtenerTenant(slug);
  if (!tenant) return { ok: false, mensaje: NO_ENCONTRADO };

  const datos = seleccionSchema.safeParse(seleccion);
  if (!datos.success) return { ok: false, mensaje: "Elige una fecha válida." };

  try {
    const r = await consultarHorarios(crearRepositorio(getDb()), tenant, datos.data, new Date());
    if (!r.ok) return { ok: false, mensaje: mensajeDeFallo(r.codigo) };
    return { ok: true, horarios: r.horarios.map((h) => ({ hora: h.hora })) };
  } catch (error) {
    console.error("Error consultando horarios:", error);
    return { ok: false, mensaje: "No pudimos cargar los horarios. Inténtalo de nuevo." };
  }
}

export async function reservarAccion(slug: string, datos: unknown): Promise<RespuestaReserva> {
  const tenant = obtenerTenant(slug);
  if (!tenant) return { ok: false, mensaje: NO_ENCONTRADO };

  const entrada = reservaSchema.safeParse(datos);
  if (!entrada.success) {
    return {
      ok: false,
      mensaje: "Revisa los datos marcados.",
      errores: erroresPorCampo(entrada.error),
    };
  }

  try {
    const resultado = await crearReserva(crearRepositorio(getDb()), tenant, entrada.data, {
      ahora: new Date(),
      ipHash: await hashDeIp(),
      generarToken: () => randomBytes(32).toString("base64url"),
    });
    if (!resultado.ok) {
      return {
        ok: false,
        mensaje: mensajeDeFallo(resultado.codigo),
        codigo: resultado.codigo === "horario_ocupado" ? "horario_ocupado" : undefined,
      };
    }

    const { reserva } = resultado;
    const correo = entrada.data.correo;
    if (correo) {
      // Después de responder: un correo lento o caído no retrasa ni rompe la reserva.
      after(async () => {
        const servicio = tenant.servicios.find((s) => s.id === entrada.data.servicioId);
        const profesional = tenant.profesionales.find((p) => p.id === reserva.profesionalId);
        await enviarCorreo({
          para: correo,
          remitente: remitenteDe(tenant),
          correo: plantillaConfirmacion({
            tenant,
            nombreCliente: entrada.data.nombre,
            servicio: servicio?.nombre ?? "",
            profesional: profesional?.nombre ?? "",
            inicio: reserva.inicio,
            codigo: codigoReserva(reserva.id),
            enlaceGestion: `${urlBase()}/${tenant.slug}/cita/${reserva.manageToken}`,
          }),
        });
      });
    }

    return { ok: true, token: reserva.manageToken };
  } catch (error) {
    console.error("Error creando la reserva:", error);
    return { ok: false, mensaje: MENSAJE_ERROR_GENERICO };
  }
}
