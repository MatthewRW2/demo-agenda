import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { advertenciasDeTenant } from "../src/lib/tenants/advertencias";
import {
  DIRECTORIO_TENANTS,
  TenantInvalidoError,
  cargarTenant,
  listarSlugs,
  validarTenant,
} from "../src/lib/tenants/cargar";

/**
 * Valida todos los negocios de tenants/ (y la plantilla).
 *   npm run validar-tenants              errores del esquema fallan; los avisos solo se muestran
 *   npm run validar-tenants -- --estricto  los avisos también hacen fallar (úsalo antes de publicar)
 */
const estricto = process.argv.includes("--estricto");
let errores = 0;
let avisos = 0;

function revisar(etiqueta: string, accion: () => string[] | void) {
  try {
    const lista = accion() ?? [];
    console.log(`OK    ${etiqueta}`);
    for (const aviso of lista) {
      avisos++;
      console.log(`AVISO   ${etiqueta} → ${aviso}`);
    }
  } catch (error) {
    errores++;
    console.error(`ERROR ${error instanceof TenantInvalidoError ? error.message : error}`);
  }
}

const slugs = listarSlugs();
if (slugs.length === 0) console.warn("No hay negocios en tenants/.");

for (const slug of slugs) {
  revisar(`tenants/${slug}.json`, () => advertenciasDeTenant(cargarTenant(slug)!));
}

// La plantilla también debe mantenerse válida (de ella nacen los negocios nuevos); sus valores de
// relleno son a propósito, así que no se le piden avisos.
const plantilla = path.join(DIRECTORIO_TENANTS, "_plantilla.json");
if (existsSync(plantilla)) {
  revisar("tenants/_plantilla.json", () => {
    validarTenant(JSON.parse(readFileSync(plantilla, "utf8")), "tenants/_plantilla.json");
  });
}

if (avisos > 0) {
  console.log(
    `\n${avisos} aviso(s): no son errores, pero revísalos antes de publicar.${estricto ? "" : " (--estricto los convierte en error)"}`,
  );
}
process.exit(errores > 0 || (estricto && avisos > 0) ? 1 : 0);
