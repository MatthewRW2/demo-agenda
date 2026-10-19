import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validarTenant } from "./cargar";
import { SLUG_REGEX } from "./schema";

const SLUG_PLANTILLA = "nombre-del-negocio";
const NOMBRE_PLANTILLA = "Nombre del Negocio";
const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "y", "&"]);

export interface OpcionesCrearNegocio {
  slug: string;
  nombre: string;
  /** Raíz del proyecto; por defecto el directorio actual. */
  raiz?: string;
}

export interface NegocioCreado {
  archivoJson: string;
  carpetaImagenes: string;
  logo: string;
}

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((p) => p && !PALABRAS_VACIAS.has(p.toLowerCase()));
  const letras = palabras.slice(0, 2).map((p) => Array.from(p)[0]);
  return letras.join("").toUpperCase() || "?";
}

/** Logo provisional: círculo con las iniciales, para no depender de imágenes con derechos. */
export function logoProvisional(nombre: string, primario: string, acento: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${escaparXml(nombre)}">
  <circle cx="100" cy="100" r="96" fill="${primario}" stroke="${acento}" stroke-width="6"/>
  <text x="100" y="100" fill="${acento}" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" text-anchor="middle" dominant-baseline="central">${escaparXml(iniciales(nombre))}</text>
</svg>
`;
}

/**
 * Copia `tenants/_plantilla.json` a `tenants/<slug>.json` (con slug, nombre y logo ya puestos)
 * y crea `public/tenants/<slug>/` con un logo provisional.
 */
export function crearNegocio({
  slug,
  nombre,
  raiz = process.cwd(),
}: OpcionesCrearNegocio): NegocioCreado {
  nombre = nombre.trim();
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(
      `El slug "${slug}" no es válido: usa minúsculas, números y guiones (ej. clinica-sonrisa).`,
    );
  }
  if (!nombre) throw new Error("Falta el nombre del negocio.");

  const archivoJson = path.join(raiz, "tenants", `${slug}.json`);
  if (existsSync(archivoJson)) {
    throw new Error(`Ya existe tenants/${slug}.json; no se sobrescribe.`);
  }

  const plantilla = readFileSync(path.join(raiz, "tenants", "_plantilla.json"), "utf8");
  // Se reemplaza sobre el texto (no con JSON.stringify) para conservar el formato de la plantilla.
  const contenido = plantilla
    .replaceAll(SLUG_PLANTILLA, slug)
    .replaceAll(NOMBRE_PLANTILLA, nombre.replace(/\\/g, "\\\\").replace(/"/g, '\\"'));

  const tenant = validarTenant(JSON.parse(contenido), `tenants/${slug}.json`);

  const carpetaImagenes = path.join(raiz, "public", "tenants", slug);
  mkdirSync(carpetaImagenes, { recursive: true });
  const archivoLogo = path.join(carpetaImagenes, "logo.svg");
  if (!existsSync(archivoLogo)) {
    writeFileSync(
      archivoLogo,
      logoProvisional(nombre, tenant.colores.primario, tenant.colores.acento),
    );
  }
  writeFileSync(archivoJson, contenido);

  return { archivoJson, carpetaImagenes, logo: tenant.logo };
}
