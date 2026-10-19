import type { ESTADOS_RESERVA } from "@/db/schema";

export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  confirmada: "Confirmada",
  completada: "Completada",
  no_asistio: "No asistió",
  cancelada: "Cancelada",
};
