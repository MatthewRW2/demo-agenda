import { MENSAJE_HORARIO_OCUPADO } from "@/db/errores";
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
