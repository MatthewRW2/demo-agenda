import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { bookings } from "../src/db/schema";
import {
  NEGOCIO,
  borrarReservasDePrueba,
  contactoDemoDe,
  hastaDatos,
  listaDeHoras,
  llenarYEnviar,
} from "./ayudas";

/** Cancelar y reprogramar una cita desde su enlace, contra la base real. */
// Cada prueba empieza con la base limpia: no dependen unas de otras.
test.beforeEach(borrarReservasDePrueba);
test.afterAll(borrarReservasDePrueba);

/** Reserva con Mateo en el último día disponible y deja la página de la cita abierta. */
async function reservarComoMateo(page: Page, nombre: string, celular: string) {
  const elegida = await hastaDatos(page, "Mateo");
  await llenarYEnviar(page, nombre, celular);
  await expect(page).toHaveURL(/\/cita\/[\w-]{43}\?nueva=1$/);
  return elegida;
}

async function filasDe(nombre: string) {
  return getDb().select().from(bookings).where(eq(bookings.customerName, nombre));
}

test("cancelar: pide confirmación, libera el horario y deja la cita como cancelada", async ({
  page,
}) => {
  const { dia, hora } = await reservarComoMateo(page, "E2E Cancela", "300 000 0011");

  await page.getByRole("button", { name: "Cancelar mi cita" }).click();
  await expect(page.getByRole("heading", { name: "¿Seguro que quieres cancelar?" })).toBeVisible();

  // Arrepentirse no cambia nada
  await page.getByRole("button", { name: "No, mantenerla" }).click();
  await expect(page.getByRole("button", { name: "Cancelar mi cita" })).toBeVisible();
  expect((await filasDe("E2E Cancela"))[0].status).toBe("confirmada");

  await page.getByRole("button", { name: "Cancelar mi cita" }).click();
  await page.getByRole("button", { name: "Sí, cancelar mi cita" }).click();

  await expect(page.getByRole("heading", { name: /Tu cita \(cancelada\)/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reservar de nuevo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar mi cita" })).toHaveCount(0);
  expect((await filasDe("E2E Cancela"))[0].status).toBe("cancelada");

  // El horario volvió a quedar libre para otra persona
  await page.goto(NEGOCIO);
  await page
    .getByRole("link", { name: /Reservar cita/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await page.getByRole("button", { name: /Mateo/ }).click();
  await page.getByRole("button", { name: dia }).click();
  await expect(listaDeHoras(page).getByRole("button", { name: hora, exact: true })).toBeVisible();
});

test("reprogramar: mueve la cita a otra hora, libera la anterior y lo avisa", async ({ page }) => {
  const { dia, hora } = await reservarComoMateo(page, "E2E Reprograma", "300 000 0012");

  await page.getByRole("button", { name: "Cambiar día u hora" }).click();
  await expect(page.getByRole("heading", { name: "Elige el nuevo día y hora" })).toBeVisible();

  await page.getByRole("button", { name: dia }).click();
  const horas = listaDeHoras(page);
  // Su propio hueco actual sigue apareciendo como libre
  await expect(horas.getByRole("button", { name: hora, exact: true })).toBeVisible();

  const nueva = horas.getByRole("button").last();
  const textoNueva = (await nueva.textContent())!.trim();
  expect(textoNueva).not.toBe(hora);
  await nueva.click();
  await expect(page.getByRole("status").filter({ hasText: "Mover a" })).toContainText(textoNueva);
  await page.getByRole("button", { name: "Confirmar cambio" }).click();

  await expect(page).toHaveURL(/\?cambiada=1$/);
  await expect(page.getByText("Listo, cambiamos tu cita.")).toBeVisible();
  // El panel de cambio se cierra y el resumen muestra la hora nueva
  await expect(page.getByRole("heading", { name: "Elige el nuevo día y hora" })).toHaveCount(0);
  await expect(page.getByRole("definition").filter({ hasText: textoNueva })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cambiar día u hora" })).toBeVisible();

  const [fila] = await filasDe("E2E Reprograma");
  expect(fila.professionalId).toBe("mateo");
  expect(fila.status).toBe("confirmada");

  // La hora anterior quedó libre y la nueva ocupada
  await page.goto(NEGOCIO);
  await page
    .getByRole("link", { name: /Reservar cita/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await page.getByRole("button", { name: /Mateo/ }).click();
  await page.getByRole("button", { name: dia }).click();
  await expect(listaDeHoras(page).getByRole("button", { name: hora, exact: true })).toBeVisible();
  await expect(
    listaDeHoras(page).getByRole("button", { name: textoNueva, exact: true }),
  ).toHaveCount(0);
});

test("reprogramar: si alguien toma la hora antes de confirmar, se avisa y la lista se actualiza", async ({
  browser,
}) => {
  const contextoA = await browser.newContext({ locale: "es-CO", timezoneId: "America/Bogota" });
  const contextoB = await browser.newContext({ locale: "es-CO", timezoneId: "America/Bogota" });
  const a = await contextoA.newPage();
  const b = await contextoB.newPage();

  const { dia } = await reservarComoMateo(a, "E2E Mueve A", "300 000 0013");
  await a.getByRole("button", { name: "Cambiar día u hora" }).click();
  await a.getByRole("button", { name: dia }).click();
  const horasA = listaDeHoras(a);
  const objetivo = horasA.getByRole("button").last();
  const textoObjetivo = (await objetivo.textContent())!.trim();
  await objetivo.click();

  // B reserva con Mateo justo esa hora
  await hastaDatos(b, "Mateo", textoObjetivo);
  await llenarYEnviar(b, "E2E Mueve B", "300 000 0014");
  await expect(b).toHaveURL(/\?nueva=1$/);

  await a.getByRole("button", { name: "Confirmar cambio" }).click();
  await expect(a.getByText("Ese horario se acaba de ocupar, elige otro.")).toBeVisible();
  await expect(horasA.getByRole("button").first()).toBeVisible();
  await expect(horasA.getByRole("button", { name: textoObjetivo, exact: true })).toHaveCount(0);
  await expect(a).not.toHaveURL(/cambiada/);

  await contextoA.close();
  await contextoB.close();
});

test("a menos de la anticipación mínima no se puede cancelar ni cambiar, y se ofrece WhatsApp", async ({
  page,
}) => {
  // La web no permite reservar tan cerca; se crea directamente en la base.
  const token = randomBytes(32).toString("base64url");
  const inicio = new Date(Date.now() + 60 * 60 * 1000); // en 1 hora; el negocio exige 2
  await getDb()
    .insert(bookings)
    .values({
      tenantSlug: "don-carlos",
      serviceId: "corte",
      professionalId: "mateo",
      startsAt: inicio,
      endsAt: new Date(inicio.getTime() + 30 * 60 * 1000),
      customerName: "E2E Cercana",
      customerPhone: "3000000015",
      manageToken: token,
    });

  await page.goto(`${NEGOCIO}/cita/${token}`);
  await expect(page.getByText(/Ya falta poco para tu cita/)).toBeVisible();
  await expect(page.getByText(/al menos 2 horas/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar mi cita" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cambiar día u hora" })).toHaveCount(0);

  // En una demo, "Escríbenos" va al contacto de quien muestra la demo (contactoDemo) o no se ofrece
  const whatsapp = page.getByRole("link", { name: /Escríbenos por WhatsApp/ });
  const contacto = contactoDemoDe("don-carlos");
  if (contacto) {
    const href = new URL((await whatsapp.getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe(`https://wa.me/${contacto.whatsapp}`);
  } else {
    await expect(whatsapp).toHaveCount(0);
  }
  expect(await page.content()).not.toContain("573001234567");
});

test("el enlace de una cita ajena o inventada no permite gestionar nada", async ({ page }) => {
  const r = await page.goto(`${NEGOCIO}/cita/${randomBytes(32).toString("base64url")}`);
  expect(r?.status()).toBe(404);
});
