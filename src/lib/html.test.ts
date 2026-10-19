import { describe, expect, it } from "vitest";
import { metaContenido, tituloDeHtml } from "./html";

const HTML = `<html><head><title>Barbería Don Carlos · Reserva tu cita</title>
<meta name="robots" content="noindex"/>
<meta property="og:image" content="https://demo.vercel.app/don-carlos/opengraph-image?f=1&amp;x=2"/>
<meta content="Cortes clásicos" property="og:description"/>
<meta property="og:title"/></head></html>`;

describe("metaContenido y tituloDeHtml", () => {
  it("lee name y property, con el atributo en cualquier orden y decodificando &amp;", () => {
    expect(metaContenido(HTML, "robots")).toBe("noindex");
    expect(metaContenido(HTML, "og:image")).toBe(
      "https://demo.vercel.app/don-carlos/opengraph-image?f=1&x=2",
    );
    expect(metaContenido(HTML, "og:description")).toBe("Cortes clásicos");
  });

  it("devuelve null si falta la etiqueta o no tiene contenido", () => {
    expect(metaContenido(HTML, "og:url")).toBeNull();
    expect(metaContenido(HTML, "og:title")).toBeNull();
    expect(metaContenido("", "robots")).toBeNull();
  });

  it("extrae el título", () => {
    expect(tituloDeHtml(HTML)).toBe("Barbería Don Carlos · Reserva tu cita");
    expect(tituloDeHtml("<p>sin título</p>")).toBeNull();
  });
});
