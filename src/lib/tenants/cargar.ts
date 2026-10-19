import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { SLUG_REGEX, tenantSchema, type Tenant } from "./schema";

export const DIRECTORIO_TENANTS = path.join(process.cwd(), "tenants");

export class TenantInvalidoError extends Error {
  constructor(
    readonly origen: string,
    readonly detalles: string[],
  ) {
    super(`${origen} no es válido:\n${detalles.map((d) => `  - ${d}`).join("\n")}`);
    this.name = "TenantInvalidoError";
  }
}

/** Convierte una ruta de Zod en algo legible: servicios[1].precio */
function formatearRuta(ruta: PropertyKey[]): string {
  const texto = ruta.reduce<string>((acc, parte) => {
    if (typeof parte === "number") return `${acc}[${parte}]`;
    return acc ? `${acc}.${String(parte)}` : String(parte);
  }, "");
  return texto || "(raíz)";
}

function describirIssue(issue: z.core.$ZodIssue): string {
  return `${formatearRuta(issue.path)}: ${issue.message}`;
}

/** Valida datos ya parseados. `origen` solo sirve para el mensaje (p. ej. "tenants/don-carlos.json"). */
export function validarTenant(datos: unknown, origen: string): Tenant {
  const resultado = tenantSchema.safeParse(datos);
  if (!resultado.success) {
    throw new TenantInvalidoError(origen, resultado.error.issues.map(describirIssue));
  }
  return resultado.data;
}

/** Lee y valida `tenants/<slug>.json`. Devuelve `null` si el negocio no existe. */
export function cargarTenant(slug: string, directorio = DIRECTORIO_TENANTS): Tenant | null {
  // El slug llega de la URL: se valida antes de tocar el disco.
  if (!SLUG_REGEX.test(slug)) return null;

  const archivo = path.join(directorio, `${slug}.json`);
  if (!existsSync(/*turbopackIgnore: true*/ archivo)) return null;

  const origen = `tenants/${slug}.json`;
  let crudo: unknown;
  try {
    crudo = JSON.parse(readFileSync(/*turbopackIgnore: true*/ archivo, "utf8"));
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    throw new TenantInvalidoError(origen, [`no es JSON válido (${motivo})`]);
  }

  const tenant = validarTenant(crudo, origen);
  if (tenant.slug !== slug) {
    throw new TenantInvalidoError(origen, [
      `slug: es "${tenant.slug}" pero el archivo se llama "${slug}.json"; deben coincidir`,
    ]);
  }
  return tenant;
}

/** Slugs de los negocios disponibles (ignora archivos que empiezan por `_`, como la plantilla). */
export function listarSlugs(directorio = DIRECTORIO_TENANTS): string[] {
  if (!existsSync(/*turbopackIgnore: true*/ directorio)) return [];
  return readdirSync(/*turbopackIgnore: true*/ directorio)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}
