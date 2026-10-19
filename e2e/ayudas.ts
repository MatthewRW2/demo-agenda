import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { like } from "drizzle-orm";
import { getDb } from "../src/db";
import { blocks, bookings, type NuevaBooking } from "../src/db/schema";

/** Todo lo que crean las pruebas lleva el nombre "E2E ..." y se borra antes y después. */
export const NEGOCIO = "/don-carlos";

export async function borrarReservasDePrueba() {
  await getDb().delete(bookings).where(like(bookings.customerName, "E2E %"));
  await getDb().delete(blocks).where(like(blocks.reason, "E2E %"));
}

/** Crea una reserva directamente en la base (para preparar datos que la web no permite crear). */
export async function crearReservaDirecta(
  datos: Pick<NuevaBooking, "customerName" | "startsAt"> & Partial<NuevaBooking>,
) {
  const duracion = 30 * 60_000;
  const [fila] = await getDb()
    .insert(bookings)
    .values({
      tenantSlug: "don-carlos",
      serviceId: "corte",
      professionalId: "carlos",
      endsAt: new Date(datos.startsAt.getTime() + duracion),
      customerPhone: "3000000000",
      manageToken: randomBytes(32).toString("base64url"),
      ...datos,
    })
    .returning();
  return fila;
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
  // El botón dice "LUN 19 oct" y, solo para lectores de pantalla, ", lunes 19 de octubre"
  const dia = (await ultimo.locator(".sr-only").textContent())!.replace(/^,\s*/, "");
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
