import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { bookings } from "../src/db/schema";
import { borrarReservasDePrueba, listaDeHoras } from "./ayudas";

/**
 * El consultorio odontológico es un segundo negocio que no es una barbería ("profesional": "odontólogo"):
 * demuestra que un negocio nuevo funciona con solo un JSON, sin tocar código.
 */
const CONTRASENA = process.env.ADMIN_PASSWORD ?? "";
const SITIO = "/clinica-sonrisa";

test.beforeEach(borrarReservasDePrueba);
test.afterAll(borrarReservasDePrueba);

async function auditar(page: Page, donde: string) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(
    r.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes[0]?.target.join(" ")}`),
    `Accesibilidad en: ${donde}`,
  ).toEqual([]);
}

test("la página usa su propia marca y habla de odontólogos, no de barberos", async ({ page }) => {
  await page.goto(SITIO);
  await expect(
    page.getByRole("heading", { level: 1, name: "Clínica Dental Sonrisa" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nuestros odontólogos" })).toBeVisible();
  await expect(page.getByText(/barbero/i)).toHaveCount(0);
  await expect(page.getByText("Limpieza dental").first()).toBeVisible();
  await expect(page.getByText(/90\.000/).first()).toBeVisible();

  // Los colores salen del JSON (#0F4C5C = rgb(15, 76, 92)), no de los de la barbería
  const fondo = await page
    .locator("header")
    .first()
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(fondo).toBe("rgb(15, 76, 92)");

  // Avatares con las iniciales sin el título: "Dra. Laura Mejía" -> "LM"
  const equipo = page.getByRole("listitem").filter({ hasText: "Dra. Laura Mejía" });
  await expect(equipo).toContainText("LM");

  // Franja de demo y metadatos propios
  await expect(page.getByRole("complementary", { name: "Aviso de demostración" })).toBeVisible();
  expect(await page.title()).toContain("Clínica Dental Sonrisa");
  await auditar(page, "consultorio: página pública");
});

test("la reserva completa: solo ofrece a quienes hacen el servicio, en su rejilla de 30 minutos", async ({
  page,
}) => {
  await page.goto(`${SITIO}/reservar`);
  await page.getByRole("button", { name: /Limpieza dental/ }).click();
  await expect(page.getByRole("heading", { name: "¿Con qué odontólogo?" })).toBeVisible();
  // El Dr. Pardo no hace limpiezas: no aparece
  await expect(page.getByRole("button", { name: /Dr\. Andrés Pardo/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Dra\. Laura Mejía/ })).toBeVisible();
  await auditar(page, "consultorio: elegir odontólogo");

  await page.getByRole("button", { name: /Dra\. Laura Mejía/ }).click();
  await page.getByRole("list", { name: "Días disponibles" }).getByRole("button").last().click();
  await expect(listaDeHoras(page).getByRole("button").first()).toBeVisible();
  const horas = (await listaDeHoras(page).getByRole("button").allTextContents()).map((t) =>
    t.trim(),
  );
  // Rejilla de 30 minutos: nunca :15 ni :45
  expect(horas.filter((h) => /:(15|45) /.test(h))).toEqual([]);
  expect(horas.length).toBeGreaterThan(0);

  await listaDeHoras(page).getByRole("button").first().click();
  await page.getByLabel("Tu nombre").fill("E2E Paciente Uno");
  await page.getByLabel("Celular").fill("300 000 0021");
  await page.getByRole("button", { name: "Confirmar cita" }).click();

  await expect(page).toHaveURL(/\/clinica-sonrisa\/cita\/[\w-]{43}\?nueva=1$/);
  await expect(page.getByText("Clínica Dental Sonrisa").first()).toBeVisible();
  await expect(
    page
      .getByText("Limpieza dental · $ 90.000")
      .or(page.getByText(/Limpieza dental · \$\s*90\.000/)),
  ).toBeVisible();
  await expect(page.getByText("Dra. Laura Mejía", { exact: true })).toBeVisible();
  await expect(page.getByText("Cra. 7 #116-50, Usaquén, Bogotá")).toBeVisible();

  // La cita quedó en el negocio correcto, con un servicio de una hora
  const [fila] = await getDb()
    .select()
    .from(bookings)
    .where(eq(bookings.customerName, "E2E Paciente Uno"));
  expect(fila).toMatchObject({
    tenantSlug: "clinica-sonrisa",
    serviceId: "limpieza",
    professionalId: "dra-mejia",
  });
  expect(fila.endsAt.getTime() - fila.startsAt.getTime()).toBe(60 * 60_000);
  expect(fila.manageToken).toHaveLength(43);

  // El enlace de la cita funciona solo dentro de su negocio
  const token = new URL(page.url()).pathname.split("/").at(-1)!;
  const ajeno = await page.goto(`/don-carlos/cita/${token}`);
  expect(ajeno?.status()).toBe(404);
});

test.describe("panel del consultorio", () => {
  test.skip(!CONTRASENA, "ADMIN_PASSWORD no está definida");

  test("agenda con sus tres odontólogos, métricas y aislamiento respecto a la barbería", async ({
    page,
  }) => {
    await page.goto(`${SITIO}/admin`);
    await page.getByLabel("Contraseña").fill(CONTRASENA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("navigation", { name: "Secciones del panel" })).toBeVisible();

    for (const nombre of ["Dra. Laura Mejía", "Dr. Andrés Pardo", "Dra. Camila Ruiz"]) {
      await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
    }
    await expect(page.getByText("ver a todos los odontólogos")).toBeVisible();
    await auditar(page, "consultorio: agenda");

    await page.goto(`${SITIO}/admin/metricas`);
    await expect(page.getByRole("heading", { name: "Métricas de la semana" })).toBeVisible();
    await expect(page.getByText("Aún no hay citas completadas ni inasistencias")).toHaveCount(0);

    // La sesión del consultorio no abre el panel de la barbería
    await page.goto("/don-carlos/admin");
    await expect(page.getByLabel("Contraseña")).toBeVisible();
  });
});
