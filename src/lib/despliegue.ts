/** ¿La dirección base es de la máquina local (desarrollo o prueba) y no un despliegue público? */
export function esDireccionLocal(base: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base);
}

/**
 * Revisa la URL de la imagen de vista previa (og:image) de una app desplegada en `base`.
 * Devuelve el problema encontrado, o null si está bien. En un despliegue público la imagen debe ser
 * absoluta, no apuntar a localhost y estar en la misma dirección (si no, falta definir APP_URL y
 * WhatsApp no podría descargarla).
 */
export function problemaDeImagenOg(imagen: string | null, base: string): string | null {
  if (!imagen) return "falta og:image";
  if (!/^https?:\/\//.test(imagen)) return `og:image no es absoluta: ${imagen}`;
  if (esDireccionLocal(base)) return null;
  if (imagen.includes("localhost")) {
    return `og:image apunta a localhost (${imagen}); define APP_URL con la dirección pública`;
  }
  const direccion = base.replace(/\/+$/, "");
  if (imagen !== direccion && !imagen.startsWith(`${direccion}/`)) {
    return `og:image (${imagen}) no está en ${direccion}; define APP_URL con esa dirección`;
  }
  return null;
}
