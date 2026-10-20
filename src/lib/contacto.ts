import { enlaceInstagram, enlaceWhatsApp } from "@/lib/enlaces";
import type { Tenant } from "@/lib/tenants/schema";

export interface ContactoPublico {
  /** Número con indicativo (573...), o `undefined` si no hay a quién escribir. */
  whatsapp?: string;
  instagram?: string;
  /** El mensaje de WhatsApp: en una demo siempre es el de "vi la demo", en un negocio real el que se pase. */
  mensaje: (base: string) => string;
}

type Datos = Pick<Tenant, "demo" | "nombre" | "whatsapp" | "instagram" | "contactoDemo">;

/**
 * A quién escribe el visitante desde la página. En un negocio real, al negocio. En una demo
 * (`"demo": true`) NUNCA al número ni al Instagram del JSON, que son de relleno y podrían ser de otra
 * persona: solo a `contactoDemo` (quien muestra la demo) y, si no lo configuró, a nadie.
 */
export function contactoPublico(tenant: Datos): ContactoPublico {
  if (!tenant.demo) {
    return { whatsapp: tenant.whatsapp, instagram: tenant.instagram, mensaje: (base) => base };
  }
  const c = tenant.contactoDemo;
  const saludo = c?.nombre ? `Hola ${c.nombre}` : "Hola";
  return {
    whatsapp: c?.whatsapp,
    instagram: c?.instagram,
    mensaje: () => `${saludo}, vi la demo de ${tenant.nombre} y quiero una para mi negocio`,
  };
}

/** Enlace wa.me de contacto, o `undefined` si no hay número al que escribir. */
export function enlaceContacto(tenant: Datos, mensajeBase: string): string | undefined {
  const c = contactoPublico(tenant);
  return c.whatsapp ? enlaceWhatsApp(c.whatsapp, c.mensaje(mensajeBase)) : undefined;
}

export function enlaceInstagramContacto(tenant: Datos): string | undefined {
  const usuario = contactoPublico(tenant).instagram;
  return usuario ? enlaceInstagram(usuario) : undefined;
}
