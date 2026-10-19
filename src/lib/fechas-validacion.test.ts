import { describe, expect, it } from "vitest";
import { enlaceGoogleCalendar } from "./enlaces";
import {
  aFechaHoraBogota,
  formatearFechaCorta,
  formatearFechaHora,
  formatearFechaLarga,
} from "./fechas";
import { erroresPorCampo, normalizarCelular, reservaSchema } from "./validacion";

describe("normalizarCelular", () => {
  it.each([
    ["3001234567", "3001234567"],
    ["300 123 4567", "3001234567"],
    ["300-123-4567", "3001234567"],
    ["+57 300 123 4567", "3001234567"],
    ["573001234567", "3001234567"],
    ["0057 300 123 4567", "3001234567"],
    ["(300) 123.4567", "3001234567"],
  ])("acepta %s", (entrada, esperado) => {
    expect(normalizarCelular(entrada)).toBe(esperado);
  });

  it.each([
    "",
    "123",
    "2001234567",
    "300123456",
    "30012345678",
    "abc3001234567",
    "6012345678",
    "+1 300 123 4567",
  ])("rechaza %j", (entrada) => {
    expect(normalizarCelular(entrada)).toBeNull();
  });
});

describe("reservaSchema", () => {
  const valida = {
    servicioId: "corte",
    profesionalId: "cualquiera",
    fecha: "2030-03-04",
    hora: "10:00",
    nombre: "  María Pérez ",
    celular: "300 123 4567",
    correo: "",
  };

  it("normaliza nombre, celular y correo vacío", () => {
    const r = reservaSchema.parse(valida);
    expect(r.nombre).toBe("María Pérez");
    expect(r.celular).toBe("3001234567");
    expect(r.correo).toBeUndefined();
  });

  it("acepta un correo válido", () => {
    expect(reservaSchema.parse({ ...valida, correo: "maria@correo.com" }).correo).toBe(
      "maria@correo.com",
    );
  });

  it("devuelve un mensaje en español por cada campo inválido", () => {
    const r = reservaSchema.safeParse({
      ...valida,
      nombre: "A",
      celular: "123",
      correo: "no-es-correo",
      hora: "25:00",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = erroresPorCampo(r.error);
      expect(e.nombre).toBe("Escribe tu nombre.");
      expect(e.celular).toMatch(/celular colombiano/);
      expect(e.correo).toMatch(/correo válido/);
      expect(e.hora).toBe("Hora inválida.");
    }
  });

  it("rechaza si faltan campos", () => {
    expect(reservaSchema.safeParse({}).success).toBe(false);
  });
});

describe("fechas en español", () => {
  it("formatea fechas largas y cortas", () => {
    expect(formatearFechaLarga("2030-03-04")).toBe("lunes 4 de marzo");
    expect(formatearFechaLarga("2030-12-25")).toBe("miércoles 25 de diciembre");
    expect(formatearFechaCorta("2030-03-09")).toEqual({ diaSemana: "Sáb", dia: 9, mes: "mar" });
  });

  it("convierte un instante UTC a la fecha y hora de Bogotá", () => {
    expect(aFechaHoraBogota(new Date("2030-03-09T00:30:00Z"))).toEqual({
      fecha: "2030-03-08",
      hora: "19:30",
    });
    expect(formatearFechaHora(new Date("2030-03-04T20:00:00Z"))).toBe(
      "lunes 4 de marzo, 3:00 p. m.",
    );
  });
});

describe("enlaceGoogleCalendar", () => {
  it("usa fechas UTC compactas y codifica el texto", () => {
    const url = new URL(
      enlaceGoogleCalendar({
        titulo: "Corte en Don Carlos",
        inicio: new Date("2030-03-04T15:00:00Z"),
        fin: new Date("2030-03-04T15:30:00Z"),
        lugar: "Cra. 13 #54-20",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20300304T150000Z/20300304T153000Z");
    expect(url.searchParams.get("text")).toBe("Corte en Don Carlos");
    expect(url.searchParams.get("location")).toBe("Cra. 13 #54-20");
    expect(url.searchParams.has("details")).toBe(false);
  });
});
