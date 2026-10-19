import type { Tenant } from "@/lib/tenants/schema";

/** Lo que el navegador necesita saber del negocio para reservar (nada más viaja al cliente). */
export type TenantPublico = Pick<
  Tenant,
  "slug" | "nombre" | "textos" | "servicios" | "profesionales"
>;

export type Paso = "servicio" | "profesional" | "fechaHora" | "datos";

export const PASOS: Paso[] = ["servicio", "profesional", "fechaHora", "datos"];

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
  "flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border-2 border-neutral-200 bg-white p-4 text-left transition hover:border-primario focus-visible:border-primario";
