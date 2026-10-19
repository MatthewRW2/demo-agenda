import { esDireccionLocal, problemaDeImagenOg } from "../src/lib/despliegue";
import { metaContenido, tituloDeHtml } from "../src/lib/html";

/**
 * Comprobaciones de humo sobre una app ya desplegada (o local):
 *   npm run verificar-despliegue -- https://mi-app.vercel.app [slug]
 * No modifica datos: el cron solo se prueba SIN credenciales (debe responder 401).
 */
const [baseEntrada, slug = "don-carlos"] = process.argv.slice(2);
if (!baseEntrada) {
  console.error("Uso: npm run verificar-despliegue -- <url-base> [slug]");
  console.error("Ej.: npm run verificar-despliegue -- https://demo-agenda.vercel.app don-carlos");
  process.exit(1);
}
const base = baseEntrada.replace(/\/+$/, "");
const esLocal = esDireccionLocal(base);

let fallos = 0;
async function comprobar(descripcion: string, prueba: () => Promise<string | void>) {
  try {
    const detalle = await prueba();
    console.log(`OK    ${descripcion}${detalle ? ` — ${detalle}` : ""}`);
  } catch (error) {
    fallos++;
    console.log(`FALLA ${descripcion} — ${error instanceof Error ? error.message : error}`);
  }
}

function exigir(condicion: boolean, mensaje: string) {
  if (!condicion) throw new Error(mensaje);
}

async function pedir(ruta: string, opciones: RequestInit = {}) {
  const inicio = Date.now();
  const respuesta = await fetch(`${base}${ruta}`, { redirect: "manual", ...opciones });
  return { respuesta, ms: Date.now() - inicio };
}

async function main() {
  console.log(`Verificando ${base} (negocio: ${slug})\n`);

  await comprobar("la raíz redirige al negocio principal", async () => {
    const { respuesta } = await pedir("/");
    exigir(
      [307, 308].includes(respuesta.status),
      `se esperaba una redirección, llegó ${respuesta.status}`,
    );
    const destino = respuesta.headers.get("location") ?? "";
    exigir(destino.endsWith("/don-carlos"), `redirige a "${destino}"`);
  });

  let html = "";
  await comprobar(`/${slug} responde 200 con título y contenido`, async () => {
    const { respuesta, ms } = await pedir(`/${slug}`);
    exigir(respuesta.status === 200, `estado ${respuesta.status}`);
    html = await respuesta.text();
    exigir(Boolean(tituloDeHtml(html)), "no tiene <title>");
    exigir(html.includes("Reservar"), 'no aparece el botón "Reservar"');
    return `${ms} ms`;
  });

  await comprobar("vista previa del link (Open Graph) con URL absoluta", async () => {
    const imagen = metaContenido(html, "og:image");
    const problema = problemaDeImagenOg(imagen, base);
    exigir(problema === null, problema ?? "");
    exigir(Boolean(metaContenido(html, "og:title")), "falta og:title");
    exigir(Boolean(metaContenido(html, "og:description")), "falta og:description");
    // La imagen se pide a la propia dirección que se está verificando
    const destino = new URL(imagen!);
    const { respuesta } = await pedir(destino.pathname + destino.search);
    exigir(respuesta.status === 200, `la imagen responde ${respuesta.status}`);
    const tipo = respuesta.headers.get("content-type") ?? "";
    exigir(tipo.startsWith("image/png"), `tipo de imagen: ${tipo}`);
    const bytes = (await respuesta.arrayBuffer()).byteLength;
    exigir(bytes > 5_000, `la imagen pesa solo ${bytes} bytes`);
    return `${tipo}, ${Math.round(bytes / 1024)} KB`;
  });

  await comprobar("/api/salud: la app responde y la base de datos también", async () => {
    const { respuesta, ms } = await pedir("/api/salud");
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; db?: string };
    exigir(
      respuesta.status === 200 && cuerpo.ok === true,
      `estado ${respuesta.status} ${JSON.stringify(cuerpo)}`,
    );
    return `${ms} ms`;
  });

  await comprobar(`/${slug}/reservar carga el flujo de reserva`, async () => {
    const { respuesta } = await pedir(`/${slug}/reservar`);
    exigir(respuesta.status === 200, `estado ${respuesta.status}`);
    const cuerpo = await respuesta.text();
    exigir(
      cuerpo.includes("¿Qué servicio quieres?") || cuerpo.includes("no hay días"),
      "no se ve el primer paso",
    );
    exigir(metaContenido(cuerpo, "robots")?.includes("noindex") === true, "debería llevar noindex");
  });

  await comprobar(`/${slug}/admin muestra el acceso (sin sesión) y no se indexa`, async () => {
    const { respuesta } = await pedir(`/${slug}/admin`);
    exigir(respuesta.status === 200, `estado ${respuesta.status}`);
    const cuerpo = await respuesta.text();
    exigir(
      cuerpo.includes("Contraseña") || cuerpo.includes("Panel no disponible"),
      "no aparece el acceso",
    );
    exigir(!cuerpo.includes("Nueva cita (cliente"), "se ve contenido del panel sin sesión");
    exigir(metaContenido(cuerpo, "robots")?.includes("noindex") === true, "debería llevar noindex");
  });

  await comprobar("un enlace de cita inventado da 404", async () => {
    const { respuesta } = await pedir(`/${slug}/cita/${"a".repeat(43)}`);
    exigir(respuesta.status === 404, `estado ${respuesta.status}`);
  });

  await comprobar("un negocio inexistente da 404", async () => {
    const { respuesta } = await pedir("/negocio-que-no-existe");
    exigir(respuesta.status === 404, `estado ${respuesta.status}`);
  });

  await comprobar("el cron rechaza peticiones sin el secreto (401)", async () => {
    const { respuesta } = await pedir("/api/cron/restablecer-demo");
    exigir(respuesta.status === 401, `estado ${respuesta.status}: el cron no debe ser público`);
  });

  console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} comprobación(es) fallaron.`);
  if (fallos === 0 && esLocal) {
    console.log("(Es una URL local: en el despliegue real repite el comando con su dirección.)");
  }
}

main()
  .then(() => process.exit(fallos > 0 ? 1 : 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
