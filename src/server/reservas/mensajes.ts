import { MENSAJE_HORARIO_OCUPADO } from "@/db/errores";
import type { FalloGestion } from "./gestion";
import type { FalloReserva } from "./servicio";

export const MENSAJE_ERROR_GENERICO =
  "No pudimos completar tu reserva. Inténtalo de nuevo en un momento.";

const MENSAJES: Record<FalloReserva, string> = {
  horario_ocupado: MENSAJE_HORARIO_OCUPADO,
  limite_celular:
    "Ya tienes varias citas pendientes con nosotros. Cancela una desde tu enlace de gestión o escríbenos por WhatsApp.",
  limite_ip:
    "Hiciste muchas reservas seguidas. Inténtalo de nuevo en un rato o escríbenos por WhatsApp.",
  servicio_invalido: "Esa opción ya no está disponible. Recarga la página e inténtalo de nuevo.",
  profesional_invalido: "Esa opción ya no está disponible. Recarga la página e inténtalo de nuevo.",
};

export function mensajeDeFallo(codigo: FalloReserva): string {
  return MENSAJES[codigo];
}

const SIN_MENSAJE_PROPIO = "No pudimos completar el cambio. Inténtalo de nuevo en un momento.";

/** Mensaje para el cliente cuando no se puede cancelar o cambiar su cita. */
export function mensajeDeGestion(codigo: FalloGestion, anticipacionMinHoras: number): string {
  switch (codigo) {
    case "no_encontrada":
      return "No encontramos esa cita.";
    case "no_activa":
      return "Esta cita ya no está activa.";
    case "pasada":
      return "Esta cita ya pasó.";
    case "muy_cerca": {
      const horas = anticipacionMinHoras === 1 ? "1 hora" : `${anticipacionMinHoras} horas`;
      return `Solo se puede cancelar o cambiar con al menos ${horas} de anticipación. Escríbenos por WhatsApp y te ayudamos.`;
    }
    case "horario_ocupado":
      return MENSAJE_HORARIO_OCUPADO;
    case "sin_cambios":
      return "Ya tienes tu cita en ese horario. Elige otro.";
    default:
      return SIN_MENSAJE_PROPIO;
  }
}
