import { describe, expect, it } from "vitest";
import { colorTextoSobre, contraste, luminancia } from "./color";
import {
  enlaceComoLlegar,
  enlaceInstagram,
  enlaceWhatsApp,
  urlBase,
  urlMapaEmbebido,
} from "./enlaces";
import {
  capitalizar,
  formatearDuracion,
  formatearHora,
  formatearHoraCorta,
  pluralizar,
} from "./texto";

describe("color", () => {
  it("luminancia de negro y blanco", () => {
    expect(luminancia("#000000")).toBe(0);
    expect(luminancia("#ffffff")).toBeCloseTo(1, 5);
  });

  it("contraste máximo entre negro y blanco, y 1 entre iguales", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contraste("#336699", "#336699")).toBe(1);
  });

  it("elige texto claro sobre fondos oscuros y oscuro sobre claros", () => {
    expect(colorTextoSobre("#1F2937")).toBe("#ffffff");
    expect(colorTextoSobre("#C8A24A")).toBe("#111111");
    expect(colorTextoSobre("#ffffff")).toBe("#111111");
    expect(colorTextoSobre("#000000")).toBe("#ffffff");
  });

  it("el texto elegido cumple AA (4.5) sobre los colores de Don Carlos", () => {
    for (const fondo of ["#1F2937", "#C8A24A"]) {
      expect(contraste(fondo, colorTextoSobre(fondo))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("texto", () => {
  it.each([
    ["barbero", "barberos"],
    ["doctor", "doctores"],
    ["odontólogo", "odontólogos"],
    ["especialista", "especialistas"],
    ["estilista", "estilistas"],
    ["masajista", "masajistas"],
    ["terapeuta", "terapeutas"],
    ["luz", "luces"],
    ["lunes", "lunes"],
  ])("pluraliza %s -> %s", (singular, plural) => {
    expect(pluralizar(singular)).toBe(plural);
  });

  it("capitaliza con tildes", () => {
    expect(capitalizar("odontólogos")).toBe("Odontólogos");
    expect(capitalizar("éxito")).toBe("Éxito");
    expect(capitalizar("")).toBe("");
  });

  it.each([
    ["00:00", "12:00 a. m."],
    ["09:00", "9:00 a. m."],
    ["11:59", "11:59 a. m."],
    ["12:00", "12:00 p. m."],
    ["13:05", "1:05 p. m."],
    ["19:00", "7:00 p. m."],
    ["23:30", "11:30 p. m."],
  ])("formatea la hora %s como %s", (entrada, esperado) => {
    expect(formatearHora(entrada)).toBe(esperado);
  });

  it.each([
    ["09:00", "9 a. m."],
    ["12:00", "12 p. m."],
    ["00:00", "12 a. m."],
    ["13:30", "1:30 p. m."],
  ])("hora corta %s -> %s", (entrada, esperado) => {
    expect(formatearHoraCorta(entrada)).toBe(esperado);
  });

  it("formatea duraciones", () => {
    expect(formatearDuracion(25)).toBe("25 min");
    expect(formatearDuracion(60)).toBe("1 h");
    expect(formatearDuracion(90)).toBe("1 h 30 min");
  });
});

describe("enlaces", () => {
  it("WhatsApp con y sin mensaje, codificando el texto", () => {
    expect(enlaceWhatsApp("573001234567")).toBe("https://wa.me/573001234567");
    expect(enlaceWhatsApp("573001234567", "Hola, ¿cómo están?")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1n%3F",
    );
  });

  it("Instagram, mapa y cómo llegar", () => {
    expect(enlaceInstagram("barberiadoncarlos")).toBe(
      "https://www.instagram.com/barberiadoncarlos/",
    );
    expect(urlMapaEmbebido("Cra. 13 #54-20, Bogotá")).toBe(
      "https://www.google.com/maps?q=Cra.%2013%20%2354-20%2C%20Bogot%C3%A1&output=embed",
    );
    expect(enlaceComoLlegar("Cra. 13 #54-20")).toContain("query=Cra.%2013%20%2354-20");
  });

  it("urlBase: APP_URL > Vercel > localhost, sin barra final", () => {
    expect(urlBase({ APP_URL: "https://demo.ejemplo.com/" })).toBe("https://demo.ejemplo.com");
    expect(urlBase({ VERCEL_PROJECT_PRODUCTION_URL: "demo.vercel.app" })).toBe(
      "https://demo.vercel.app",
    );
    expect(urlBase({ APP_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "demo.vercel.app" })).toBe(
      "https://demo.vercel.app",
    );
    expect(urlBase({})).toBe("http://localhost:3000");
  });
});
