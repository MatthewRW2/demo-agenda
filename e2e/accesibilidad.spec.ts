import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { borrarReservasDePrueba, crearReservaDirecta, listaDeHoras, NEGOCIO } from "./ayudas";

/**
 * Accesibilidad (axe-core: WCAG 2.0/2.1/2.2 A y AA, más buenas prácticas) en todas las pantallas y
 * estados, y ninguna pantalla con desborde horizontal a 320 px (el celular más angosto habitual).
 */
const CONTRASENA = process.env.ADMIN_PASSWORD ?? "";
const CRON = process.env.CRON_SECRET ?? "";
const ADMIN = `${NEGOCIO}/admin`;

test.beforeAll(async ({ request }) => {
  await borrarReservasDePrueba();
  // Con la demo recién sembrada el panel tiene de todo para revisar
  if (CRON)
    await request.get("/api/cron/restablecer-demo", {
      headers: { Authorization: `Bearer ${CRON}` },
    });
});
test.afterAll(borrarReservasDePrueba);

async function auditar(page: Page, donde: string) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const resumen = r.violations.map(
    (v) =>
      `${v.id} [${v.impact}] ${v.help} -> ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(" | ")}`,
  );
  expect(resumen, `Accesibilidad en: ${donde}`).toEqual([]);
}

async function entrar(page: Page, ruta = ADMIN) {
  await page.goto(ruta);
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
}

test.describe("sitio público", () => {
  test("página del negocio y 404", async ({ page }) => {
    await page.goto(NEGOCIO);
    await auditar(page, "página del negocio");

    await page.goto("/no-existe-este-negocio");
    await expect(page.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
    await auditar(page, "404 general");

    await page.goto(`${NEGOCIO}/cita/${"a".repeat(43)}`);
    await expect(page.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
    await auditar(page, "404 dentro del negocio");
  });

  test("cada paso de la reserva, con sus errores", async ({ page }) => {
    await page.goto(`${NEGOCIO}/reservar`);
    await auditar(page, "reservar: paso 1 (servicio)");

    await page.getByRole("button", { name: /Corte clásico/ }).click();
    await expect(page.getByRole("heading", { name: /¿Con qué barbero\?/ })).toBeVisible();
    await auditar(page, "reservar: paso 2 (profesional)");

    await page.getByRole("button", { name: /Cualquiera/ }).click();
    await auditar(page, "reservar: paso 3 antes de elegir día");

    await page.getByRole("list", { name: "Días disponibles" }).getByRole("button").last().click();
    await expect(listaDeHoras(page).getByRole("button").first()).toBeVisible();
    await auditar(page, "reservar: paso 3 con horas");

    await listaDeHoras(page).getByRole("button").first().click();
    await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
    await auditar(page, "reservar: paso 4 (datos)");

    await page.getByLabel("Celular").fill("123");
    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(page.getByText(/celular colombiano/)).toBeVisible();
    await auditar(page, "reservar: paso 4 con errores de validación");
  });

  test("la cita: vista, cancelar y cambiar horario", async ({ page }) => {
    const cita = await crearReservaDirecta({
      customerName: "E2E Accesible",
      startsAt: new Date("2031-03-04T15:00:00Z"), // lejano: no choca con la demo sembrada
      manageToken: randomBytes(32).toString("base64url"),
    });
    await page.goto(`${NEGOCIO}/cita/${cita.manageToken}?nueva=1`);
    await expect(page.getByText("¡Listo, E2E!")).toBeVisible();
    await auditar(page, "cita recién creada");

    await page.getByRole("button", { name: "Cancelar mi cita" }).click();
    await expect(
      page.getByRole("heading", { name: "¿Seguro que quieres cancelar?" }),
    ).toBeVisible();
    await auditar(page, "cita: confirmar cancelación");

    await page.getByRole("button", { name: "No, mantenerla" }).click();
    await page.getByRole("button", { name: "Cambiar día u hora" }).click();
    await page.getByRole("list", { name: "Días disponibles" }).getByRole("button").last().click();
    await expect(listaDeHoras(page).getByRole("button").first()).toBeVisible();
    await listaDeHoras(page).getByRole("button").first().click();
    await expect(page.getByRole("button", { name: "Confirmar cambio" })).toBeVisible();
    await auditar(page, "cita: cambiar horario");
  });
});

test.describe("panel", () => {
  test.skip(!CONTRASENA, "ADMIN_PASSWORD no está definida");

  test("pantalla de acceso, también con error", async ({ page }) => {
    await page.goto(ADMIN);
    await auditar(page, "login");
    await page.getByLabel("Contraseña").fill("mala");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
    await auditar(page, "login con error");
  });

  test("agenda del día con detalle y formularios abiertos, semana, recordatorios y métricas", async ({
    page,
  }) => {
    await entrar(page, `${ADMIN}?vista=semana`);
    await expect(page.getByRole("heading", { name: /Semana del/ })).toBeVisible();
    await auditar(page, "agenda de la semana");

    // abrir el detalle de una cita desde la semana
    await page
      .getByRole("link", { name: /\d:\d\d [ap]\. m\. · / })
      .first()
      .click();
    await expect(page.getByTestId("detalle-cita")).toBeVisible();
    await auditar(page, "agenda del día con detalle de cita");

    await page.getByText(/Nueva cita \(cliente sin reserva\)/).click();
    await page.getByText("Bloquear un horario").click();
    await expect(page.locator("#cm-hora")).toBeVisible();
    await auditar(page, "agenda con los formularios de cita manual y bloqueo abiertos");

    await page.getByRole("button", { name: "Restablecer demo" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await auditar(page, "agenda con la confirmación de restablecer demo");

    await page.goto(`${ADMIN}/recordatorios`);
    await expect(page.getByRole("heading", { name: "Recordatorios de mañana" })).toBeVisible();
    await auditar(page, "recordatorios");

    await page.goto(`${ADMIN}/metricas`);
    await expect(page.getByRole("heading", { name: "Métricas de la semana" })).toBeVisible();
    await auditar(page, "métricas");
  });
});

test.describe("sin desborde horizontal a 320 px", () => {
  test("ninguna pantalla se sale del ancho", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const cita = await crearReservaDirecta({
      customerName: "E2E Angosta",
      startsAt: new Date("2031-03-05T15:00:00Z"),
    });
    const sinDesborde = async (donde: string) => {
      const exceso = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(exceso, `desborde horizontal en ${donde}`).toBeLessThanOrEqual(0);
    };

    for (const ruta of [
      NEGOCIO,
      `${NEGOCIO}/reservar`,
      `${NEGOCIO}/cita/${cita.manageToken}`,
      "/no-existe",
    ]) {
      await page.goto(ruta);
      await sinDesborde(ruta);
    }

    // Los estados interactivos también: carrusel de días, horas, formulario y paneles de la cita
    await page.goto(`${NEGOCIO}/reservar`);
    await page.getByRole("button", { name: /Corte clásico/ }).click();
    await page.getByRole("button", { name: /Cualquiera/ }).click();
    await sinDesborde("reservar: carrusel de días");
    await page.getByRole("list", { name: "Días disponibles" }).getByRole("button").last().click();
    await expect(listaDeHoras(page).getByRole("button").first()).toBeVisible();
    await sinDesborde("reservar: horas");
    await listaDeHoras(page).getByRole("button").first().click();
    await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
    await page.getByLabel("Celular").fill("123");
    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(page.getByText(/celular colombiano/)).toBeVisible();
    await sinDesborde("reservar: formulario con errores");

    await page.goto(`${NEGOCIO}/cita/${cita.manageToken}?nueva=1`);
    await page.getByRole("button", { name: "Cancelar mi cita" }).click();
    await sinDesborde("cita: confirmar cancelación");
    await page.getByRole("button", { name: "No, mantenerla" }).click();
    await page.getByRole("button", { name: "Cambiar día u hora" }).click();
    await sinDesborde("cita: panel de cambio (carrusel)");
    await page.getByRole("list", { name: "Días disponibles" }).getByRole("button").last().click();
    await expect(listaDeHoras(page).getByRole("button").first()).toBeVisible();
    await listaDeHoras(page).getByRole("button").first().click();
    await expect(page.getByRole("button", { name: "Confirmar cambio" })).toBeVisible();
    await sinDesborde("cita: cambio con hora elegida");

    if (CONTRASENA) {
      await entrar(page);
      for (const ruta of [
        ADMIN,
        `${ADMIN}?vista=semana`,
        `${ADMIN}/recordatorios`,
        `${ADMIN}/metricas`,
      ]) {
        await page.goto(ruta);
        await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
        await sinDesborde(ruta);
      }

      // agenda del día con una cita abierta y los formularios desplegados
      await page.goto(`${ADMIN}?vista=semana`);
      await page
        .getByRole("link", { name: /\d:\d\d [ap]\. m\. · / })
        .first()
        .click();
      await expect(page.getByTestId("detalle-cita")).toBeVisible();
      await page.getByText(/Nueva cita \(cliente sin reserva\)/).click();
      await page.getByText("Bloquear un horario").click();
      await sinDesborde("agenda del día con detalle y formularios");
    }
  });
});
