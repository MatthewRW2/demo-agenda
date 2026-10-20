import type { Tenant } from "@/lib/tenants/schema";

export interface Preseleccion {
  servicioId?: string;
  /** Sin servicio, significa "quiero con esta persona": el servicio se elige entre los suyos. */
  profesionalId?: string;
  fecha?: string;
  /** Solo se confirma al cargar los horarios reales: aquí únicamente tiene formato válido. */
  hora?: string;
}

type Valor = string | string[] | undefined;

const primero = (v: Valor) => (Array.isArray(v) ? v[0] : v);

/**
 * Lo que el enlace ya trae elegido ("Reservar este", "Reservar con X", un horario de la tarjeta).
 * Es solo comodidad de la interfaz: cada parámetro se valida contra el negocio y los días reservables,
 * y uno inválido corta la cadena (sin servicio válido no se acepta profesional, y así). La reserva se
 * vuelve a validar completa en el servidor.
 */
export function preseleccionDesdeConsulta(
  tenant: Pick<Tenant, "servicios" | "profesionales">,
  dias: string[],
  consulta: Record<string, Valor>,
): Preseleccion {
  const servicio = tenant.servicios.find((s) => s.id === primero(consulta.servicio));
  const pedido = tenant.profesionales.find((p) => p.id === primero(consulta.profesional));
  // "Reservar con X" trae solo el profesional: falta elegir el servicio, entre los que él ofrece.
  if (!servicio) return pedido ? { profesionalId: pedido.id } : {};

  const profesional = pedido?.servicios.includes(servicio.id) ? pedido : undefined;
  if (!profesional) return { servicioId: servicio.id };

  const fecha = dias.find((d) => d === primero(consulta.fecha));
  if (!fecha) return { servicioId: servicio.id, profesionalId: profesional.id };

  const hora = primero(consulta.hora);
  return {
    servicioId: servicio.id,
    profesionalId: profesional.id,
    fecha,
    hora: hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : undefined,
  };
}
