import { enlaceWhatsApp } from "@/lib/enlaces";
import { formatearFechaHora } from "@/lib/fechas";
import type { Tenant } from "@/lib/tenants/schema";

/** Código corto y legible de una reserva (las 6 primeras letras/números de su id). */
export function codigoReserva(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export interface DatosMensaje {
  tenant: Tenant;
  nombreCliente: string;
  servicio: string;
  profesional: string;
  inicio: Date;
  codigo: string;
}

/** Enlace wa.me al negocio con la confirmación de la cita ya escrita. */
export function enlaceConfirmarPorWhatsApp(d: DatosMensaje): string {
  const mensaje =
    `Hola, soy ${d.nombreCliente}. Confirmo mi ${d.tenant.textos.reserva} de ${d.servicio} ` +
    `con ${d.profesional} el ${formatearFechaHora(d.inicio)}. Código: ${d.codigo}.`;
  return enlaceWhatsApp(d.tenant.whatsapp, mensaje);
}
