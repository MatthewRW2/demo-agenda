import { expect, test } from "@playwright/test";
import { contactoDemoDe, whatsappDeRelleno } from "./ayudas";

/**
 * En una demo, el contacto es el de quien la muestra (contactoDemo). El número y el Instagram del JSON
 * son de relleno: nunca deben salir en un enlace ni en el HTML.
 */
for (const [slug, nombre] of [
  ["don-carlos", "Barbería Don Carlos"],
  ["clinica-sonrisa", "Clínica Dental Sonrisa"],
] as const) {
  test(`${slug}: los botones de contacto usan solo contactoDemo`, async ({ page }) => {
    const contacto = contactoDemoDe(slug);
    for (const ruta of [`/${slug}`, `/${slug}/reservar`]) {
      await page.goto(ruta);
      const html = await page.content();
      expect(html, `${ruta} no debe traer el número de relleno`).not.toContain(
        whatsappDeRelleno(slug),
      );
      expect(html).not.toMatch(/instagram\.com\/(?!p\/)(barberiadoncarlos|clinicadentalsonrisa)/);
    }

    await page.goto(`/${slug}`);
    const enlaces = await page
      .locator('a[href*="wa.me"]')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    const instagram = await page.locator('a[href*="instagram.com"]').count();

    if (!contacto) {
      expect(enlaces).toEqual([]);
      expect(instagram).toBe(0);
      return;
    }
    expect(enlaces.length).toBeGreaterThan(0);
    for (const e of enlaces) {
      const url = new URL(e);
      expect(url.origin + url.pathname).toBe(`https://wa.me/${contacto.whatsapp}`);
      const saludo = contacto.nombre ? `Hola ${contacto.nombre}` : "Hola";
      expect(url.searchParams.get("text")).toBe(
        `${saludo}, vi la demo de ${nombre} y quiero una para mi negocio`,
      );
    }
    expect(instagram).toBe(contacto.instagram ? 1 : 0);
  });
}

test("el formulario de la demo avisa que se pueden usar datos inventados", async ({ page }) => {
  await page.goto("/don-carlos/reservar?servicio=corte&profesional=carlos");
  await page.getByRole("list", { name: "Días disponibles" }).getByRole("button").last().click();
  await page
    .getByRole("button", { name: /[ap]\. m\./ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
  await expect(page.getByText("Es una demo: puedes usar datos inventados.")).toBeVisible();
  await expect(page.getByText(/Te escribiremos por WhatsApp/)).toHaveCount(0);
});

test("las reseñas de cada negocio son de su sector y van rotuladas como ejemplo", async ({
  page,
}) => {
  await page.goto("/clinica-sonrisa");
  const seccion = page.getByRole("region", { name: "Reseñas de ejemplo" });
  await expect(seccion).toContainText("recordatorio");
  await expect(seccion).toContainText("puntualidad");
  await expect(seccion).not.toContainText(/barba|degradado|barbero/i);

  await page.goto("/don-carlos");
  const barberia = page.getByRole("region", { name: "Reseñas de ejemplo" });
  await expect(barberia).toContainText(/degradado|barba/);
  await expect(barberia).not.toContainText(/odont|diente|limpieza dental/i);
});
