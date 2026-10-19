import { config } from "dotenv";
import { getDb } from "../src/db";
import { cargarTenant, TenantInvalidoError } from "../src/lib/tenants/cargar";
import { sembrarDemo } from "../src/server/demo/sembrar";

config({ path: ".env.local" });

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: npm run seed -- <slug>");
    console.error("Ej.: npm run seed -- don-carlos");
    process.exit(1);
  }

  const tenant = cargarTenant(slug);
  if (!tenant) {
    console.error(`No existe tenants/${slug}.json.`);
    process.exit(1);
  }
  if (!tenant.demo) {
    console.error(
      `"${slug}" no es un negocio de demostración ("demo": false). No se borra ni se siembra nada.`,
    );
    process.exit(1);
  }

  const { reservas, bloqueos } = await sembrarDemo(getDb(), tenant, new Date());
  console.log(`Datos de ejemplo de ${tenant.nombre}:`);
  console.log(`  ${reservas} citas (últimas 2 semanas y próximas 2) y ${bloqueos} bloqueos.`);
  console.log("Se reemplazaron las citas y bloqueos que había de este negocio.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof TenantInvalidoError ? error.message : error);
    process.exit(1);
  });
