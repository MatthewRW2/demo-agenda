/** Enlace wa.me con mensaje precargado. `numero` incluye el indicativo, sin + (ej. 573001234567). */
export function enlaceWhatsApp(numero: string, mensaje?: string): string {
  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

export function enlaceInstagram(usuario: string): string {
  return `https://www.instagram.com/${usuario}/`;
}

/** Mapa embebible de Google Maps por dirección; no necesita API key. */
export function urlMapaEmbebido(direccion: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`;
}

export function enlaceComoLlegar(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

/**
 * URL pública de la app, sin barra final. Prioridad: APP_URL, el dominio de producción que expone
 * Vercel y, en local, http://localhost:3000.
 */
export function urlBase(env: Record<string, string | undefined> = process.env): string {
  const explicita = env.APP_URL?.trim();
  if (explicita) return explicita.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

function aFormatoCalendario(instante: Date): string {
  return instante
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export interface DatosCalendario {
  titulo: string;
  inicio: Date;
  fin: Date;
  detalles?: string;
  lugar?: string;
}

/** Enlace "Agregar a Google Calendar" (plantilla de evento, fechas en UTC). */
export function enlaceGoogleCalendar({ titulo, inicio, fin, detalles, lugar }: DatosCalendario) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${aFormatoCalendario(inicio)}/${aFormatoCalendario(fin)}`,
  });
  if (detalles) params.set("details", detalles);
  if (lugar) params.set("location", lugar);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export interface ParametrosReserva {
  servicio?: string;
  profesional?: string;
  fecha?: string;
  hora?: string;
}

/**
 * Enlace al flujo de reserva con parte de la elección ya hecha (por ejemplo "Reservar este" ya trae el
 * servicio). El flujo valida cada parámetro; uno inválido o vencido se ignora.
 */
export function enlaceReservar(slug: string, params: ParametrosReserva = {}): string {
  const consulta = new URLSearchParams();
  for (const clave of ["servicio", "profesional", "fecha", "hora"] as const) {
    const valor = params[clave];
    if (valor) consulta.set(clave, valor);
  }
  const texto = consulta.toString();
  return `/${slug}/reservar${texto ? `?${texto}` : ""}`;
}
