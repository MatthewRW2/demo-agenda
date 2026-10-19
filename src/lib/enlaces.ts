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
