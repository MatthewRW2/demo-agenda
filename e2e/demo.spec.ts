import { expect, test, type Page } from "@playwright/test";
import { count, eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { blocks, bookings } from "../src/db/schema";
import { diaDeSemana, hoyEnBogota, sumarDias } from "../src/lib/disponibilidad";
import { cargarTenant } from "../src/lib/tenants/cargar";
import { NEGOCIO, borrarReservasDePrueba, crearReservaDirecta } from "./ayudas";

/** Modo demo: franja, datos de ejemplo, cron diario y botón "Restablecer demo". */
const CONTRASENA = process.env.ADMIN_PASSWORD ?? "";
const CRON = process.env.CRON_SECRET ?? "";
const ADMIN = `${NEGOCIO}/admin`;
const RUTA_CRON = "/api/cron/restablecer-demo";

test.beforeEach(borrarReservasDePrueba);
test.afterAll(borrarReservasDePrueba);

async function entrar(page: Page, ruta = ADMIN) {
  await page.goto(ruta);
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
}

async function contarDon() {
  const db = getDb();
  const [r] = await db
    .select({ n: count() })
    .from(bookings)
    .where(eq(bookings.tenantSlug, "don-carlos"));
  const [b] = await db
    .select({ n: count() })
    .from(blocks)
    .where(eq(blocks.tenantSlug, "don-carlos"));
  return { reservas: r.n, bloqueos: b.n };
}

test("la franja 'Demo con datos ficticios' aparece en el sitio, la reserva y el panel", async ({
  page,
}) => {
  for (const ruta of [NEGOCIO, `${NEGOCIO}/reservar`, ADMIN]) {
    await page.goto(ruta);
    await expect(page.getByRole("complementary", { name: "Aviso de demostración" })).toBeVisible();
  }
});

test.describe("cron diario", () => {
  test.skip(!CRON, "CRON_SECRET no está definida");

  test("sin el secreto correcto responde 401 y no toca los datos", async ({ request }) => {
    const antes = await contarDon();
    const sinEncabezado = await request.get(RUTA_CRON);
    expect(sinEncabezado.status()).toBe(401);
    const incorrecto = await request.get(RUTA_CRON, {
      headers: { Authorization: "Bearer incorrecto" },
    });
    expect(incorrecto.status()).toBe(401);
    const sinBearer = await request.get(RUTA_CRON, { headers: { Authorization: CRON } });
    expect(sinBearer.status()).toBe(401);
    expect((await incorrecto.json()).ok).toBe(false);
    expect(await contarDon()).toEqual(antes);
  });

  test("con el secreto vuelve a sembrar la demo (y borra lo que había)", async ({ request }) => {
    await crearReservaDirecta({
      customerName: "E2E Debe Desaparecer",
      startsAt: new Date(Date.now() + 5 * 86_400_000),
    });
    const r = await request.get(RUTA_CRON, { headers: { Authorization: `Bearer ${CRON}` } });
    expect(r.status()).toBe(200);
    const cuerpo = await r.json();
    expect(cuerpo.ok).toBe(true);
    // Todos los negocios con "demo": true se restablecen (hoy: la barbería y el consultorio)
    expect(cuerpo.negocios).toEqual(
      expect.arrayContaining([
        { slug: "clinica-sonrisa", reservas: 60, bloqueos: 2 },
        { slug: "don-carlos", reservas: 60, bloqueos: 2 },
      ]),
    );
    expect(await contarDon()).toEqual({ reservas: 60, bloqueos: 2 });
    const fantasma = await getDb()
      .select()
      .from(bookings)
      .where(eq(bookings.customerName, "E2E Debe Desaparecer"));
    expect(fantasma).toHaveLength(0);
  });

  test("el cron no acepta POST (solo GET, como lo llama Vercel)", async ({ request }) => {
    const r = await request.post(RUTA_CRON, { headers: { Authorization: `Bearer ${CRON}` } });
    expect(r.status()).toBe(405);
  });
});

test.describe("botón Restablecer demo", () => {
  test.skip(!CONTRASENA, "ADMIN_PASSWORD no está definida");

  test("pide confirmación, y al confirmar deja los datos de ejemplo", async ({ page }) => {
    await crearReservaDirecta({
      customerName: "E2E Se Borra Al Restablecer",
      startsAt: new Date(Date.now() + 6 * 86_400_000),
    });
    await entrar(page);

    await page.getByRole("button", { name: "Restablecer demo" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(
      "Se borrarán todas las citas y bloqueos",
    );

    // Arrepentirse no borra nada
    await page.getByRole("button", { name: "No, cancelar" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect(
      await getDb()
        .select()
        .from(bookings)
        .where(eq(bookings.customerName, "E2E Se Borra Al Restablecer")),
    ).toHaveLength(1);

    await page.getByRole("button", { name: "Restablecer demo" }).click();
    await page.getByRole("button", { name: "Sí, restablecer" }).click();
    await expect(page.getByText("Demo restablecida: 60 citas de ejemplo.")).toBeVisible();
    expect(await contarDon()).toEqual({ reservas: 60, bloqueos: 2 });
    expect(
      await getDb()
        .select()
        .from(bookings)
        .where(eq(bookings.customerName, "E2E Se Borra Al Restablecer")),
    ).toHaveLength(0);
  });
});

test.describe("el panel se ve vivo con los datos de ejemplo", () => {
  test.skip(!CONTRASENA || !CRON, "faltan ADMIN_PASSWORD o CRON_SECRET");

  test.beforeEach(async ({ request }) => {
    await request.get(RUTA_CRON, { headers: { Authorization: `Bearer ${CRON}` } });
  });

  test("agenda de la semana, recordatorios de mañana y métricas tienen datos", async ({ page }) => {
    const tenant = cargarTenant("don-carlos")!;
    await entrar(page, `${ADMIN}?vista=semana`);
    const citas = page.getByRole("listitem").filter({ hasText: /\d:\d\d [ap]\. m\. ·/ });
    // El panel llega por streaming: se espera a que aparezca el contenido antes de contar
    await expect(citas.first()).toBeVisible();
    expect(await citas.count()).toBeGreaterThanOrEqual(5);

    // Recordatorios de mañana
    const manana = sumarDias(hoyEnBogota(new Date()), 1);
    await page.goto(`${ADMIN}/recordatorios`);
    if (tenant.horario[diaDeSemana(manana)]) {
      const botones = page.getByRole("link", { name: /Enviar recordatorio|Enviar de nuevo/ });
      await expect(botones.first()).toBeVisible();
      expect(await botones.count()).toBeGreaterThanOrEqual(3);
    } else {
      await expect(page.getByText("No hay citas confirmadas para mañana")).toBeVisible();
    }

    // Métricas de la semana con datos
    await page.goto(`${ADMIN}/metricas`);
    await expect(page.getByRole("heading", { name: "Métricas de la semana" })).toBeVisible();
    await expect(page.getByText("Aún no hay citas completadas ni inasistencias")).toHaveCount(0);
    await expect(page.getByText("$").first()).toBeVisible();
  });

  test("la semana pasada tiene citas completadas, inasistencias y canceladas", async ({ page }) => {
    const lunesPasado = sumarDias(hoyEnBogota(new Date()), -7);
    await entrar(page, `${ADMIN}/metricas?fecha=${lunesPasado}`);
    await expect(page.getByText(/\d+ de \d+ citas? resueltas?/)).toBeVisible();
    await expect(page.getByText(/cancelada/).first()).toBeVisible();
  });
});
