import { crearNegocio } from "../src/lib/tenants/crear";
import { TenantInvalidoError } from "../src/lib/tenants/cargar";

const [slug, nombre] = process.argv.slice(2);

if (!slug || !nombre) {
  console.error('Uso: npm run nuevo-negocio -- <slug> "<Nombre del negocio>"');
  console.error('Ej.: npm run nuevo-negocio -- clinica-sonrisa "Clínica Dental Sonrisa"');
  process.exit(1);
}

try {
  const { archivoJson, carpetaImagenes } = crearNegocio({ slug, nombre });
  console.log(`Negocio creado: ${nombre}\n`);
  console.log(`  Configuración: ${archivoJson}`);
  console.log(`  Imágenes:      ${carpetaImagenes} (ya tiene un logo.svg provisional)\n`);
  console.log("Siguientes pasos:");
  console.log("  1. Edita el JSON: colores, servicios, precios, profesionales, horario, WhatsApp.");
  console.log("  2. Reemplaza logo.svg y agrega las fotos de los profesionales.");
  console.log(`  3. npm run validar-tenants   (revisa que el JSON esté bien)`);
  console.log(`  4. npm run seed -- ${slug}   (datos de ejemplo, disponible desde la Fase 8)`);
  console.log(`  5. Abre http://localhost:3000/${slug}`);
} catch (error) {
  if (error instanceof TenantInvalidoError) {
    console.error(error.message);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
}
