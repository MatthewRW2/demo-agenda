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

export interface DatosRecordatorio {
  tenant: Tenant;
  nombreCliente: string;
  /** Celular de 10 dígitos; vacío si la cita se registró sin celular. */
  celular: string;
  /** Hora de la cita ya formateada ("3:00 p. m."). */
  hora: string;
  /** Enlace absoluto para cambiar o cancelar la cita. */
  enlaceGestion: string;
}

/**
 * Enlace wa.me al cliente con el recordatorio de su cita de mañana. Devuelve `null` si la cita no
 * tiene celular.
 */
export function enlaceRecordatorio(d: DatosRecordatorio): string | null {
  if (!d.celular) return null;
  const primerNombre = d.nombreCliente.trim().split(/\s+/)[0];
  const mensaje =
    `Hola ${primerNombre}, te recordamos tu ${d.tenant.textos.reserva} mañana a las ${d.hora} ` +
    `en ${d.tenant.nombre}. Si no puedes asistir, cámbiala o cancélala aquí: ${d.enlaceGestion}`;
  return enlaceWhatsApp(`57${d.celular}`, mensaje);
}
