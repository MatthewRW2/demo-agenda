/**
 * Valor de una etiqueta <meta> (property="og:image", name="robots"...) en un HTML. Es suficiente para
 * las comprobaciones de despliegue; no pretende ser un parser de HTML completo.
 */
export function metaContenido(html: string, clave: string): string | null {
  for (const etiqueta of html.match(/<meta\s[^>]*>/gi) ?? []) {
    const nombre = /(?:property|name)="([^"]*)"/i.exec(etiqueta)?.[1];
    if (nombre !== clave) continue;
    const contenido = /content="([^"]*)"/i.exec(etiqueta)?.[1];
    if (contenido !== undefined) return contenido.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  }
  return null;
}

/** Contenido de <title>, o null. */
export function tituloDeHtml(html: string): string | null {
  return /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? null;
}
