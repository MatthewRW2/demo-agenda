import { formatearFechaHora } from "@/lib/fechas";
import type { Tenant } from "@/lib/tenants/schema";

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface DatosConfirmacion {
  tenant: Tenant;
  nombreCliente: string;
  servicio: string;
  profesional: string;
  inicio: Date;
  codigo: string;
  /** Enlace absoluto para ver o gestionar la cita. */
  enlaceGestion: string;
}

export interface Correo {
  asunto: string;
  html: string;
  texto: string;
}

/** Contenido del correo de confirmación. Todo lo que viene del cliente va escapado. */
export function plantillaConfirmacion(d: DatosConfirmacion): Correo {
  const cuando = formatearFechaHora(d.inicio);
  const reserva = d.tenant.textos.reserva;
  const asunto = `Tu ${reserva} en ${d.tenant.nombre} está confirmada`;

  const texto = [
    `Hola ${d.nombreCliente},`,
    ``,
    `Tu ${reserva} quedó confirmada.`,
    `Servicio: ${d.servicio}`,
    `Con: ${d.profesional}`,
    `Cuándo: ${cuando}`,
    `Dónde: ${d.tenant.direccion}`,
    `Código: ${d.codigo}`,
    ``,
    `Para verla, cancelarla o cambiarla: ${d.enlaceGestion}`,
    ``,
    d.tenant.nombre,
  ].join("\n");

  const fila = (etiqueta: string, valor: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#555">${etiqueta}</td><td style="padding:4px 0"><strong>${escaparHtml(valor)}</strong></td></tr>`;

  const html = `<!doctype html>
<html lang="es-CO"><body style="font-family:Arial,Helvetica,sans-serif;color:#171717;max-width:480px;margin:0 auto;padding:16px">
<h1 style="font-size:20px">Tu ${escaparHtml(reserva)} está confirmada</h1>
<p>Hola ${escaparHtml(d.nombreCliente)}, estos son los datos de tu ${escaparHtml(reserva)}:</p>
<table style="border-collapse:collapse">
${fila("Servicio", d.servicio)}
${fila("Con", d.profesional)}
${fila("Cuándo", cuando)}
${fila("Dónde", d.tenant.direccion)}
${fila("Código", d.codigo)}
</table>
<p style="margin:24px 0"><a href="${escaparHtml(d.enlaceGestion)}" style="background:${escaparHtml(d.tenant.colores.primario)};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Ver o gestionar mi ${escaparHtml(reserva)}</a></p>
<p style="color:#555">${escaparHtml(d.tenant.nombre)}</p>
</body></html>`;

  return { asunto, html, texto };
}

export type ResultadoEnvio =
  { enviado: true } | { enviado: false; motivo: "sin_clave" | "rechazado" | "error" };

interface OpcionesEnvio {
  para: string;
  remitente: string;
  correo: Correo;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
}

/**
 * Envía un correo con Resend. Si no hay `RESEND_API_KEY` no hace nada; si Resend falla, lo
 * registra y devuelve el motivo: un correo caído nunca debe romper una reserva.
 */
export async function enviarCorreo({
  para,
  remitente,
  correo,
  env = process.env,
  fetchFn = fetch,
}: OpcionesEnvio): Promise<ResultadoEnvio> {
  const clave = env.RESEND_API_KEY?.trim();
  if (!clave) return { enviado: false, motivo: "sin_clave" };

  try {
    const respuesta = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remitente,
        to: [para],
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!respuesta.ok) {
      console.error(`Resend rechazó el correo (HTTP ${respuesta.status}).`);
      return { enviado: false, motivo: "rechazado" };
    }
    return { enviado: true };
  } catch (error) {
    console.error("No se pudo enviar el correo:", error instanceof Error ? error.message : error);
    return { enviado: false, motivo: "error" };
  }
}

/** Remitente: RESEND_FROM si existe; si no, el de pruebas de Resend con el nombre del negocio. */
export function remitenteDe(tenant: Tenant, env: Record<string, string | undefined> = process.env) {
  const configurado = env.RESEND_FROM?.trim();
  if (configurado) return configurado;
  const nombre = tenant.nombre.replace(/["<>\r\n]/g, "");
  return `${nombre} <onboarding@resend.dev>`;
}
