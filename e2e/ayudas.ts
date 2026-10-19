import { expect, type Page } from "@playwright/test";
import { like } from "drizzle-orm";
import { getDb } from "../src/db";
import { bookings } from "../src/db/schema";

/** Todo lo que crean las pruebas lleva el nombre "E2E ..." y se borra antes y después. */
export const NEGOCIO = "/don-carlos";

export async function borrarReservasDePrueba() {
  await getDb().delete(bookings).where(like(bookings.customerName, "E2E %"));
}

/**
 * Recorre servicio -> profesional -> día -> hora y se detiene en el formulario de datos.
 * Elige el último día del carrusel (el más lejano) y la primera hora libre.
 */
export async function hastaDatos(page: Page, profesional: string, hora?: string) {
  await page.goto(NEGOCIO);
  await page
    .getByRole("link", { name: /Reservar cita/ })
    .first()
    .click();
  await page.getByRole("button", { name: /Corte clásico/ }).click();
  await page.getByRole("button", { name: new RegExp(profesional) }).click();

  const dias = page.getByRole("list", { name: "Días disponibles" }).getByRole("button");
  const ultimo = dias.last();
  const dia = (await ultimo.getAttribute("aria-label"))!;
  await ultimo.click();

  const horas = page
    .getByRole("list")
    .filter({ has: page.getByRole("button", { name: /[ap]\. m\./ }) });
  const boton = hora
    ? horas.getByRole("button", { name: hora, exact: true })
    : horas.getByRole("button").first();
  await expect(boton).toBeVisible();
  const horaElegida = (await boton.textContent())!.trim();
  await boton.click();

  await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
  return { dia, hora: horaElegida };
}

export async function llenarYEnviar(page: Page, nombre: string, celular: string) {
  await page.getByLabel("Tu nombre").fill(nombre);
  await page.getByLabel("Celular").fill(celular);
  await page.getByRole("button", { name: "Confirmar cita" }).click();
}

/** Lista de botones de hora de la pantalla actual. */
export function listaDeHoras(page: Page) {
  return page.getByRole("list").filter({ has: page.getByRole("button", { name: /[ap]. m./ }) });
}
