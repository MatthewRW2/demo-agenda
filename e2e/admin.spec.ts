import { expect, test, type Page } from "@playwright/test";
import { eq, like } from "drizzle-orm";
import { getDb } from "../src/db";
import { bookings } from "../src/db/schema";
import { diasDisponibles, hoyEnBogota, limitesDelDia, sumarDias } from "../src/lib/disponibilidad";
import { cargarTenant } from "../src/lib/tenants/cargar";
import { NEGOCIO, borrarReservasDePrueba, crearReservaDirecta, listaDeHoras } from "./ayudas";

/** Panel del negocio: acceso, agenda, estados, citas manuales, bloqueos, recordatorios y métricas. */
const CONTRASENA = process.env.ADMIN_PASSWORD ?? "";
const ADMIN = `${NEGOCIO}/admin`;
// Lunes lejano: la web pública no llega ahí, así que no choca con otras reservas ni con la demo.
const LUNES = "2031-03-03";
const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);

test.beforeEach(borrarReservasDePrueba);
test.afterAll(borrarReservasDePrueba);

async function entrar(page: Page, ruta = ADMIN) {
  await page.goto(ruta);
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();
}

test.describe("acceso", () => {
  test.skip(!CONTRASENA, "ADMIN_PASSWORD no está definida");

  test("sin sesión solo se ve el formulario, y la demo muestra la contraseña", async ({ page }) => {
    for (const ruta of [ADMIN, `${ADMIN}/recordatorios`, `${ADMIN}/metricas`]) {
      await page.goto(ruta);
      await expect(
        page.getByRole("heading", { name: /Panel de Barbería Don Carlos/ }),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toHaveCount(0);
    }
    await expect(page.getByTestId("contrasena-demo")).toHaveText(CONTRASENA);
  });

  test("una contraseña incorrecta se rechaza con un mensaje; la correcta entra y deja una cookie httpOnly", async ({
    page,
    context,
  }) => {
    await page.goto(ADMIN);
    await page.getByLabel("Contraseña").fill("incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
    expect((await context.cookies()).filter((c) => c.name.startsWith("admin_"))).toHaveLength(0);

    await page.getByLabel("Contraseña").fill(CONTRASENA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === "admin_don-carlos");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/don-carlos/admin" });
    // La cookie no contiene la contraseña en claro
    expect(cookie!.value).not.toContain(CONTRASENA);
    // y JavaScript de la página no puede leerla
    expect(await page.evaluate(() => document.cookie)).not.toContain("admin_");
  });

  test("salir cierra la sesión", async ({ page }) => {
    await entrar(page);
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await page.goto(`${ADMIN}/metricas`);
    await expect(page.getByLabel("Contraseña")).toBeVisible();
  });

  test("si la sesión vence, las acciones lo avisan y no cambian nada", async ({
    page,
    context,
  }) => {
    const cita = await crearReservaDirecta({
      customerName: "E2E Sesion",
      startsAt: bogota(LUNES, "10:00"),
    });
    await entrar(page, `${ADMIN}?fecha=${LUNES}&cita=${cita.id}`);
    await expect(page.getByTestId("detalle-cita")).toBeVisible();

    await context.clearCookies(); // la sesión "venció"
    await page.getByRole("button", { name: /Marcar completada/ }).click();
    await expect(page.getByText("Tu sesión terminó. Vuelve a entrar.")).toBeVisible();

    const [fila] = await getDb().select().from(bookings).where(eq(bookings.id, cita.id));
    expect(fila.status).toBe("confirmada");
  });
});

test.describe("agenda", () => {
  test.skip(!CONTRASENA, "ADMIN_PASSWORD no está definida");

  test("muestra la cita en la columna de su profesional y permite cambiarle el estado", async ({
    page,
  }) => {
    const cita = await crearReservaDirecta({
      customerName: "E2E Agenda",
      startsAt: bogota(LUNES, "10:00"),
      professionalId: "carlos",
    });
    await entrar(page, `${ADMIN}?fecha=${LUNES}`);

    await expect(page.getByRole("heading", { name: /lunes 3 de marzo/ })).toBeVisible();
    const enCarlos = page.locator('[data-columna="carlos"]').locator(`[data-cita="${cita.id}"]`);
    await expect(enCarlos).toBeVisible();
    await expect(
      page.locator('[data-columna="andres"]').locator(`[data-cita="${cita.id}"]`),
    ).toHaveCount(0);

    await enCarlos.click();
    const detalle = page.getByTestId("detalle-cita");
    await expect(detalle.getByRole("heading", { name: "E2E Agenda" })).toBeVisible();
    await expect(detalle).toContainText("Confirmada");

    await detalle.getByRole("button", { name: /Marcar no asistió/ }).click();
    await expect(detalle).toContainText("No asistió");
    expect((await getDb().select().from(bookings).where(eq(bookings.id, cita.id)))[0].status).toBe(
      "no_asistio",
    );

    await detalle.getByRole("button", { name: /Cancelar cita/ }).click();
    await expect(detalle).toContainText("Cancelada");
    // una cancelada libera el hueco: ya no se dibuja en la agenda
    await expect(page.locator(`[data-cita="${cita.id}"]`)).toHaveCount(0);
    await expect(page.getByText(/1 cita cancelada/)).toBeVisible();

    await detalle.getByRole("button", { name: /Volver a confirmada/ }).click();
    await expect(page.locator(`[data-cita="${cita.id}"]`)).toBeVisible();
  });

  test("no deja reactivar una cita cancelada si su horario ya lo ocupó otra", async ({ page }) => {
    const cancelada = await crearReservaDirecta({
      customerName: "E2E Cancelada",
      startsAt: bogota(LUNES, "11:00"),
      status: "cancelada",
    });
    await crearReservaDirecta({ customerName: "E2E Ocupa", startsAt: bogota(LUNES, "11:00") });
    await entrar(page, `${ADMIN}?fecha=${LUNES}&cita=${cancelada.id}`);

    await page.getByRole("button", { name: /Volver a confirmada/ }).click();
    await expect(page.getByText(/Ese horario se acaba de ocupar/)).toBeVisible();
    expect(
      (await getDb().select().from(bookings).where(eq(bookings.id, cancelada.id)))[0].status,
    ).toBe("cancelada");
  });

  test("la vista de semana lista las citas por día y cada una abre su detalle", async ({
    page,
  }) => {
    await crearReservaDirecta({
      customerName: "E2E Semana",
      startsAt: bogota("2031-03-05", "15:00"),
    });
    await entrar(page, `${ADMIN}?vista=semana&fecha=${LUNES}`);
    await expect(page.getByRole("heading", { name: /Semana del lunes 3 de marzo/ })).toBeVisible();
    const dia = page.getByRole("listitem").filter({ hasText: "miércoles 5 de marzo" }).first();
    await expect(dia).toContainText("1 cita");
    await dia.getByRole("link", { name: /E2E Semana/ }).click();
    await expect(
      page.getByTestId("detalle-cita").getByRole("heading", { name: "E2E Semana" }),
    ).toBeVisible();
  });

  test("crear una cita manual: sin celular, vale una hora que el público ya no ve, y no permite duplicarla", async ({
    page,
  }) => {
    await entrar(page, `${ADMIN}?fecha=${LUNES}`);
    await page.getByText(/Nueva cita \(cliente sin reserva\)/).click();
    await page.locator("#cm-prof").selectOption("andres");
    await page.locator("#cm-fecha").fill(LUNES);
    const hora = page.locator("#cm-hora");
    await expect(hora.locator("option", { hasText: "9:00 a. m." })).toHaveCount(1);
    await hora.selectOption({ label: "9:00 a. m." });
    await page.locator("#cm-nombre").fill("E2E Manual");
    await page.getByRole("button", { name: "Guardar cita" }).click();

    await expect(page.getByText("Cita guardada.")).toBeVisible();
    const [fila] = await getDb()
      .select()
      .from(bookings)
      .where(eq(bookings.customerName, "E2E Manual"));
    expect(fila).toMatchObject({
      source: "admin",
      professionalId: "andres",
      customerPhone: "",
      status: "confirmada",
    });
    await expect(
      page.locator('[data-columna="andres"]').locator(`[data-cita="${fila.id}"]`),
    ).toBeVisible();

    // esa hora ya no se ofrece para Andrés
    await expect(hora.locator("option", { hasText: "9:00 a. m." })).toHaveCount(0);
  });

  test("crear una cita manual valida el nombre y el celular", async ({ page }) => {
    await entrar(page, `${ADMIN}?fecha=${LUNES}`);
    await page.getByText(/Nueva cita \(cliente sin reserva\)/).click();
    await page.locator("#cm-prof").selectOption("mateo");
    await page.locator("#cm-hora").selectOption({ label: "10:00 a. m." });
    await page.locator("#cm-nombre").fill("E2E Celular Malo");
    await page.locator("#cm-celular").fill("123");
    await page.getByRole("button", { name: "Guardar cita" }).click();
    await expect(page.getByText(/celular colombiano de 10 dígitos/)).toBeVisible();
    expect(
      await getDb().select().from(bookings).where(like(bookings.customerName, "E2E Celular%")),
    ).toHaveLength(0);
  });
});

test.describe("bloqueos", () => {
  test.skip(!CONTRASENA, "ADMIN_PASSWORD no está definida");

  test("bloquear horas las quita del flujo público, y quitar el bloqueo las devuelve", async ({
    page,
    browser,
  }) => {
    const tenant = cargarTenant("don-carlos")!;
    const dia = diasDisponibles(tenant, new Date()).at(-1)!; // último día reservable en la web
    await entrar(page, `${ADMIN}?fecha=${dia}`);

    await page.getByText("Bloquear un horario").click();
    await page.locator("#bl-desde").fill("12:00");
    await page.locator("#bl-hasta").fill("14:00");
    await page.locator("#bl-motivo").fill("E2E almuerzo");
    await page.getByRole("button", { name: "Bloquear horario" }).click();
    await expect(page.getByText("Horario bloqueado.")).toBeVisible();
    await expect(page.getByRole("list").filter({ hasText: "E2E almuerzo" })).toBeVisible();
    // un bloqueo del local dibuja una banda en cada columna
    await expect(page.locator("[data-bloqueo]")).toHaveCount(tenant.profesionales.length);

    // El público (otro navegador) ya no ve esas horas
    const publico = await browser.newContext({ locale: "es-CO", timezoneId: "America/Bogota" });
    const p = await publico.newPage();
    const horasPublicas = async () => {
      await p.goto(NEGOCIO);
      await p
        .getByRole("link", { name: /Reservar cita/ })
        .first()
        .click();
      await p.getByRole("button", { name: /Corte clásico/ }).click();
      await p.getByRole("button", { name: /Mateo/ }).click();
      await p.getByRole("list", { name: "Días disponibles" }).getByRole("button").last().click();
      await expect(listaDeHoras(p).getByRole("button").first()).toBeVisible();
      return listaDeHoras(p);
    };
    let horas = await horasPublicas();
    await expect(horas.getByRole("button", { name: "12:00 p. m.", exact: true })).toHaveCount(0);
    await expect(horas.getByRole("button", { name: "1:45 p. m.", exact: true })).toHaveCount(0);
    await expect(horas.getByRole("button", { name: "11:30 a. m.", exact: true })).toBeVisible();
    await expect(horas.getByRole("button", { name: "2:00 p. m.", exact: true })).toBeVisible();

    // Quitar el bloqueo devuelve las horas
    await page.getByRole("button", { name: /Quitar bloqueo de Todo el local/ }).click();
    await expect(page.locator("[data-bloqueo]")).toHaveCount(0);
    horas = await horasPublicas();
    await expect(horas.getByRole("button", { name: "12:00 p. m.", exact: true })).toBeVisible();
    await publico.close();
  });

  test("avisa si el bloqueo cae sobre citas confirmadas y valida las horas", async ({ page }) => {
    await crearReservaDirecta({ customerName: "E2E Afectada", startsAt: bogota(LUNES, "12:30") });
    await entrar(page, `${ADMIN}?fecha=${LUNES}`);
    await page.getByText("Bloquear un horario").click();
    await page.locator("#bl-desde").fill("14:00");
    await page.locator("#bl-hasta").fill("12:00");
    await page.getByRole("button", { name: "Bloquear horario" }).click();
    await expect(page.getByText(/posterior al inicio/)).toBeVisible();

    await page.locator("#bl-desde").fill("12:00");
    await page.locator("#bl-hasta").fill("14:00");
    await page.locator("#bl-motivo").fill("E2E aviso");
    await page.getByRole("button", { name: "Bloquear horario" }).click();
    await expect(page.getByText(/hay 1 cita confirmada en ese rango/)).toBeVisible();
  });
});

test.describe("recordatorios y métricas", () => {
  test.skip(!CONTRASENA, "ADMIN_PASSWORD no está definida");

  test("lista las citas de mañana, abre WhatsApp con el mensaje y marca el recordatorio como enviado", async ({
    page,
    context,
  }) => {
    const manana = sumarDias(hoyEnBogota(new Date()), 1);
    const diez = new Date(limitesDelDia(manana).desde.getTime() + 10 * 3_600_000);
    const conCelular = await crearReservaDirecta({
      customerName: "E2E Recordar Mucho",
      customerPhone: "3001112233",
      startsAt: diez,
      professionalId: "andres",
    });
    await crearReservaDirecta({
      customerName: "E2E Sin Celular",
      customerPhone: "",
      startsAt: new Date(diez.getTime() + 3_600_000),
    });
    await crearReservaDirecta({
      customerName: "E2E Cancelada Manana",
      startsAt: new Date(diez.getTime() + 7_200_000),
      status: "cancelada",
    });

    // WhatsApp real no se abre en las pruebas
    await context.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "ok" }));
    await entrar(page, `${ADMIN}/recordatorios`);

    const fila = page.getByRole("listitem").filter({ hasText: "E2E Recordar Mucho" });
    await expect(fila).toContainText("10:00 a. m.");
    await expect(page.getByRole("listitem").filter({ hasText: "E2E Sin Celular" })).toContainText(
      "Sin celular",
    );
    await expect(page.getByText("E2E Cancelada Manana")).toHaveCount(0);

    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      fila.getByRole("link", { name: /Enviar recordatorio/ }).click(),
    ]);
    const url = new URL(popup.url());
    expect(url.origin + url.pathname).toBe("https://wa.me/573001112233");
    const texto = url.searchParams.get("text")!;
    expect(texto).toContain(
      "Hola E2E, te recordamos tu cita mañana a las 10:00 a. m. en Barbería Don Carlos",
    );
    expect(texto).toContain(`/don-carlos/cita/${conCelular.manageToken}`);
    await popup.close();

    await expect(fila.getByTestId("recordatorio-enviado")).toBeVisible();
    const [fresca] = await getDb().select().from(bookings).where(eq(bookings.id, conCelular.id));
    expect(fresca.reminderSentAt).not.toBeNull();

    // al recargar sigue marcado
    await page.reload();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "E2E Recordar Mucho" })
        .getByTestId("recordatorio-enviado"),
    ).toBeVisible();
  });

  test("las métricas de la semana salen con las cifras esperadas", async ({ page }) => {
    // Semana del 3 al 9 de marzo de 2031 (sin más datos): cifras conocidas
    await crearReservaDirecta({
      customerName: "E2E M1",
      startsAt: bogota("2031-03-03", "10:00"),
      status: "completada",
      serviceId: "corte",
    }); // 25.000
    await crearReservaDirecta({
      customerName: "E2E M2",
      startsAt: bogota("2031-03-04", "10:30"),
      status: "completada",
      serviceId: "corte-barba",
      professionalId: "andres",
    }); // 40.000
    await crearReservaDirecta({
      customerName: "E2E M3",
      startsAt: bogota("2031-03-05", "15:00"),
      status: "no_asistio",
      serviceId: "nino",
      professionalId: "mateo",
    });
    await crearReservaDirecta({
      customerName: "E2E M4",
      startsAt: bogota("2031-03-06", "16:00"),
      status: "cancelada",
      serviceId: "barba",
    });
    await crearReservaDirecta({
      customerName: "E2E M5",
      startsAt: bogota("2031-03-07", "10:15"),
      status: "confirmada",
      serviceId: "corte",
    }); // 25.000

    await entrar(page, `${ADMIN}/metricas?fecha=2031-03-05`);
    await expect(page.getByRole("heading", { name: "Métricas de la semana" })).toBeVisible();
    const tarjeta = (titulo: string) =>
      page.locator("div", { has: page.getByText(titulo, { exact: true }) }).last();

    await expect(tarjeta("Citas")).toContainText("4");
    await expect(tarjeta("Citas")).toContainText("1 cancelada");
    await expect(tarjeta("Inasistencias")).toContainText("33,3 %");
    await expect(tarjeta("Inasistencias")).toContainText("1 de 3 citas resueltas");
    await expect(tarjeta("Ingresos estimados")).toContainText(/90\.000/);
    await expect(tarjeta("Servicio más pedido")).toContainText("Corte clásico");
    await expect(tarjeta("Servicio más pedido")).toContainText("2 citas");
    await expect(tarjeta("Hora más ocupada")).toContainText("10:00 a. m. – 11:00 a. m.");
    await expect(tarjeta("Hora más ocupada")).toContainText("3 citas");
  });

  test("la semana sin citas muestra ceros y guiones, no cifras inventadas", async ({ page }) => {
    await entrar(page, `${ADMIN}/metricas?fecha=2032-06-07`);
    await expect(page.getByRole("heading", { name: "Métricas de la semana" })).toBeVisible();
    await expect(page.getByText("Aún no hay citas completadas ni inasistencias")).toBeVisible();
    await expect(page.getByText("—").first()).toBeVisible();
  });
});
