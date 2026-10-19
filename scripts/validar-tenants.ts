import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DIRECTORIO_TENANTS,
  TenantInvalidoError,
  cargarTenant,
  listarSlugs,
  validarTenant,
} from "../src/lib/tenants/cargar";

let errores = 0;

function revisar(etiqueta: string, accion: () => unknown) {
  try {
    accion();
    console.log(`OK    ${etiqueta}`);
  } catch (error) {
    errores++;
    console.error(`ERROR ${error instanceof TenantInvalidoError ? error.message : error}`);
  }
}

const slugs = listarSlugs();
if (slugs.length === 0) console.warn("No hay negocios en tenants/.");

for (const slug of slugs) revisar(`tenants/${slug}.json`, () => cargarTenant(slug));

// La plantilla también debe mantenerse válida: de ella nacen los negocios nuevos.
const plantilla = path.join(DIRECTORIO_TENANTS, "_plantilla.json");
if (existsSync(plantilla)) {
  revisar("tenants/_plantilla.json", () =>
    validarTenant(JSON.parse(readFileSync(plantilla, "utf8")), "tenants/_plantilla.json"),
  );
}

process.exit(errores > 0 ? 1 : 0);
