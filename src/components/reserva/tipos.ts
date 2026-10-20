import type { Tenant } from "@/lib/tenants/schema";

/** Lo que el navegador necesita saber del negocio para reservar (nada más viaja al cliente). */
export type TenantPublico = Pick<
  Tenant,
  "slug" | "nombre" | "textos" | "servicios" | "profesionales" | "whatsapp" | "logo"
>;

export type Paso = "servicio" | "profesional" | "fechaHora" | "datos";

export const PASOS: Paso[] = ["servicio", "profesional", "fechaHora", "datos"];

export const ETIQUETA_PASO: Record<Paso, string> = {
  servicio: "Servicio",
  profesional: "Profesional",
  fechaHora: "Día y hora",
  datos: "Tus datos",
};

export type EstadoHorarios =
  | { estado: "inicial" }
  | { estado: "cargando" }
  | { estado: "listo"; horas: string[] }
  | { estado: "error"; mensaje: string };

export interface DatosFormulario {
  nombre: string;
  celular: string;
  correo: string;
}

export const CLASE_OPCION =
  "flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border-2 border-linea bg-white p-4 text-left transition hover:border-primario focus-visible:border-primario";
