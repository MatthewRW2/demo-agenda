import { config } from "dotenv";
import { getDb } from "../src/db";
import { cargarTenant, TenantInvalidoError } from "../src/lib/tenants/cargar";
import { vaciarDemo } from "../src/server/demo/sembrar";

config({ path: ".env.local" });

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: npm run vaciar-demo -- <slug>");
    process.exit(1);
  }
  const tenant = cargarTenant(slug);
  if (!tenant) {
    console.error(`No existe tenants/${slug}.json.`);
    process.exit(1);
  }
  if (!tenant.demo) {
    console.error(
      `"${slug}" no es un negocio de demostración ("demo": false). Sus datos no se borran con este comando.`,
    );
    process.exit(1);
  }
  const { reservas, bloqueos } = await vaciarDemo(getDb(), tenant);
  console.log(`${tenant.nombre}: se borraron ${reservas} citas y ${bloqueos} bloqueos.`);
  console.log('Siguiente paso para un cliente real: cambia "demo" a false en su JSON y haz push.');
  console.log("(Con demo:true el cron diario volvería a sembrar datos de ejemplo.)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof TenantInvalidoError ? error.message : error);
    process.exit(1);
  });
