import type { Tenant } from "@/lib/tenants/schema";

export interface ResenaVista {
  autor: string;
  texto: string;
  estrellas: number;
  fuente?: string;
}

/**
 * Reseñas inventadas para que una demo muestre cómo se vería la sección. Solo se usan en negocios con
 * `"demo": true`, siempre rotuladas como ejemplo, y hablan de lo que el sistema de verdad hace (reservar
 * desde el celular, recordatorios por WhatsApp, cambiar la cita), nunca del servicio de un negocio.
 */
export const RESENAS_DE_EJEMPLO: ResenaVista[] = [
  {
    autor: "María F.",
    texto:
      "Reservé desde el celular en menos de un minuto y me atendieron justo a la hora. Todo claro desde el principio.",
    estrellas: 5,
    fuente: "Ejemplo",
  },
  {
    autor: "Andrés R.",
    texto: "Me llegó el recordatorio por WhatsApp y pude cambiar la cita sin llamar a nadie.",
    estrellas: 5,
    fuente: "Ejemplo",
  },
  {
    autor: "Luisa M.",
    texto: "Se nota el cuidado en cada detalle. Volveré.",
    estrellas: 5,
    fuente: "Ejemplo",
  },
];

/**
 * Qué reseñas mostrar: las reales del JSON si las hay; si no, las de ejemplo solo en una demo; y en un
 * negocio real sin reseñas, ninguna (la sección se oculta).
 */
export function resenasParaMostrar(
  tenant: Pick<Tenant, "resenas" | "demo">,
): { resenas: ResenaVista[]; esEjemplo: boolean } | null {
  if (tenant.resenas && tenant.resenas.length > 0) {
    return { resenas: tenant.resenas, esEjemplo: false };
  }
  if (tenant.demo) return { resenas: RESENAS_DE_EJEMPLO, esEjemplo: true };
  return null;
}
