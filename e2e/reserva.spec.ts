import { expect, test } from "@playwright/test";
import { like } from "drizzle-orm";
import { getDb } from "../src/db";
import { bookings } from "../src/db/schema";

/**
 * Flujo de reserva de principio a fin contra la base de datos real (Neon).
 * Todo lo que crean estas pruebas lleva el nombre "E2E ..." y se borra antes y después.
 */
import { NEGOCIO, borrarReservasDePrueba, hastaDatos, llenarYEnviar } from "./ayudas";

test.beforeAll(borrarReservasDePrueba);
test.afterAll(borrarReservasDePrueba);

test.describe.serial("reserva", () => {
  let elegida: { dia: string; hora: string };

  test("completa una reserva de principio a fin", async ({ page }) => {
    elegida = await hastaDatos(page, "Carlos");
    await llenarYEnviar(page, "E2E Prueba Uno", "300 000 0001");

    await expect(page).toHaveURL(/\/don-carlos\/cita\/[\w-]{43}\?nueva=1$/);
    await expect(page.getByRole("status").filter({ hasText: "¡Listo, E2E!" })).toBeVisible();
    await expect(page.getByText("Corte clásico")).toBeVisible();
    await expect(page.getByText("Carlos", { exact: true })).toBeVisible();
    await expect(page.getByText(elegida.hora)).toBeVisible();

    const calendario = page.getByRole("link", { name: /Agregar a Google Calendar/ });
    await expect(calendario).toHaveAttribute(
      "href",
      /^https:\/\/calendar\.google\.com\/calendar\/render\?/,
    );

    // En una demo el número del JSON es de relleno: no se ofrece confirmar por WhatsApp ni sale en la página
    await expect(page.getByRole("link", { name: /Confirmar por WhatsApp/ })).toHaveCount(0);
    expect(await page.content()).not.toContain("573001234567");

    // El enlace de la cita se puede abrir de nuevo (y no cambia los datos)
    const enlace = new URL(page.url());
    await page.goto(enlace.pathname);
    await expect(page.getByText("Confirmada")).toBeVisible();

    const filas = await getDb().select().from(bookings).where(like(bookings.customerName, "E2E %"));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      customerPhone: "3000000001",
      professionalId: "carlos",
      serviceId: "corte",
      status: "confirmada",
      source: "web",
    });
  });

  test("el horario reservado ya no aparece libre", async ({ page }) => {
    await page.goto(NEGOCIO);
    await page
      .getByRole("link", { name: /Reservar cita/ })
      .first()
      .click();
    await page.getByRole("button", { name: /Corte clásico/ }).click();
    await page.getByRole("button", { name: /Carlos/ }).click();
    await page.getByRole("button", { name: elegida.dia }).click();

    const horas = page
      .getByRole("list")
      .filter({ has: page.getByRole("button", { name: /[ap]\. m\./ }) });
    await expect(horas.getByRole("button").first()).toBeVisible();
    await expect(horas.getByRole("button", { name: elegida.hora, exact: true })).toHaveCount(0);
  });

  test("con 'Cualquiera' ese horario sigue libre porque otros barberos están disponibles", async ({
    page,
  }) => {
    await page.goto(NEGOCIO);
    await page
      .getByRole("link", { name: /Reservar cita/ })
      .first()
      .click();
    await page.getByRole("button", { name: /Corte clásico/ }).click();
    await page.getByRole("button", { name: /Cualquiera/ }).click();
    await page.getByRole("button", { name: elegida.dia }).click();

    const horas = page
      .getByRole("list")
      .filter({ has: page.getByRole("button", { name: /[ap]\. m\./ }) });
    await expect(horas.getByRole("button", { name: elegida.hora, exact: true })).toBeVisible();
  });
});

test("si alguien se adelanta, se avisa con amabilidad y se vuelve a elegir hora", async ({
  browser,
}) => {
  const contextoA = await browser.newContext({ locale: "es-CO", timezoneId: "America/Bogota" });
  const contextoB = await browser.newContext({ locale: "es-CO", timezoneId: "America/Bogota" });
  const a = await contextoA.newPage();
  const b = await contextoB.newPage();

  // A llega al formulario con Andrés...
  const { hora } = await hastaDatos(a, "Andrés");
  // ...y B reserva ese mismo horario con Andrés antes de que A confirme.
  await hastaDatos(b, "Andrés", hora);
  await llenarYEnviar(b, "E2E Prueba Dos", "300 000 0002");
  await expect(b).toHaveURL(/\/cita\/[\w-]{43}\?nueva=1$/);

  await llenarYEnviar(a, "E2E Prueba Tres", "300 000 0003");
  await expect(a.getByText("Ese horario se acaba de ocupar, elige otro.")).toBeVisible();
  await expect(a.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
  const horasA = a.getByRole("list").filter({ has: a.getByRole("button", { name: /[ap]\. m\./ }) });
  await expect(horasA.getByRole("button").first()).toBeVisible();
  await expect(horasA.getByRole("button", { name: hora, exact: true })).toHaveCount(0);

  await contextoA.close();
  await contextoB.close();
});

test("valida el celular antes de reservar y explica el error", async ({ page }) => {
  await hastaDatos(page, "Mateo");
  await llenarYEnviar(page, "E2E Prueba Cuatro", "12345");

  await expect(page.getByText(/celular colombiano de 10 dígitos/)).toBeVisible();
  await expect(page.getByLabel("Celular")).toHaveAttribute("aria-invalid", "true");
  await expect(page).not.toHaveURL(/\/cita\//);

  // Corrige y reserva con un formato con +57
  await page.getByLabel("Celular").fill("+57 300 000 0004");
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(page).toHaveURL(/\/cita\/[\w-]{43}\?nueva=1$/);
});

test("un enlace de cita inventado da 404", async ({ page }) => {
  const r = await page.goto(`${NEGOCIO}/cita/${"a".repeat(43)}`);
  expect(r?.status()).toBe(404);
  const r2 = await page.goto(`${NEGOCIO}/cita/corto`);
  expect(r2?.status()).toBe(404);
});
