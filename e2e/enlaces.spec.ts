import { expect, test } from "@playwright/test";

/** Los botones de la página pública entran al flujo con parte de la elección hecha (no escriben datos). */

test("'Reservar este' entra al flujo con el servicio elegido", async ({ page }) => {
  await page.goto("/don-carlos");
  await page.getByRole("link", { name: /Reservar este servicio: Corte clásico/ }).click();
  await expect(page).toHaveURL(/\/don-carlos\/reservar\?servicio=corte$/);
  await expect(page.getByRole("heading", { name: /¿Con qué barbero\?/ })).toBeVisible();
});

test("'Reservar con' entra al flujo con servicio y profesional, directo a elegir el día", async ({
  page,
}) => {
  await page.goto("/don-carlos/reservar?servicio=corte&profesional=carlos");
  await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
});

test("'Reservar con Mateo' deja elegir solo entre sus servicios y salta el paso del barbero", async ({
  page,
}) => {
  await page.goto("/don-carlos");
  await page.getByRole("link", { name: "Reservar con Mateo" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué servicio quieres?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Corte niño/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Corte \+ barba/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Corte niño/ }).click();
  await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
});

test("parámetros inválidos se ignoran y el flujo empieza desde el principio", async ({ page }) => {
  await page.goto("/don-carlos/reservar?servicio=inventado&profesional=carlos&fecha=2020-01-01");
  await expect(page.getByRole("heading", { name: "¿Qué servicio quieres?" })).toBeVisible();
});

test("una hora ya vencida en el enlace deja elegir otra, sin romper", async ({ page }) => {
  await page.goto(
    "/don-carlos/reservar?servicio=corte&profesional=carlos&fecha=2020-01-01&hora=10:00",
  );
  await expect(page.getByRole("heading", { name: "¿Cuándo?" })).toBeVisible();
});

test("el resumen acompaña cada paso y los horarios vienen agrupados", async ({ page }) => {
  await page.goto("/don-carlos/reservar?servicio=corte&profesional=carlos");
  const resumen = page.getByRole("region", { name: "Resumen de tu cita" });
  await expect(resumen).toContainText("Corte clásico");
  await expect(resumen).toContainText("Carlos");

  await expect(
    page.getByRole("navigation", { name: "Progreso" }).getByRole("listitem"),
  ).toHaveCount(4);
  await expect(page.getByRole("listitem").filter({ hasText: "Día y hora" })).toHaveAttribute(
    "aria-current",
    "step",
  );

  await page.getByRole("list", { name: "Días disponibles" }).getByRole("button").last().click();
  await expect(page.getByRole("heading", { name: "Mañana" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tarde" })).toBeVisible();

  const primera = page.getByRole("button", { name: /[ap]\. m\./ }).first();
  const hora = (await primera.textContent())!.trim();
  await primera.click();
  await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
  await expect(resumen).toContainText(hora);
});
