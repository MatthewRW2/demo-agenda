import { describe, expect, it } from "vitest";
import { enlaceReservar } from "./enlaces";
import { etiquetaDia } from "./fechas";

describe("enlaceReservar", () => {
  it("sin parámetros, solo la ruta del flujo", () => {
    expect(enlaceReservar("don-carlos")).toBe("/don-carlos/reservar");
  });

  it("agrega solo los parámetros que vienen y en orden estable", () => {
    expect(enlaceReservar("don-carlos", { servicio: "corte" })).toBe(
      "/don-carlos/reservar?servicio=corte",
    );
    expect(
      enlaceReservar("don-carlos", {
        hora: "15:30",
        profesional: "carlos",
        servicio: "corte",
        fecha: "2030-03-06",
      }),
    ).toBe("/don-carlos/reservar?servicio=corte&profesional=carlos&fecha=2030-03-06&hora=15%3A30");
  });

  it("ignora los vacíos", () => {
    expect(enlaceReservar("x", { servicio: "", profesional: undefined })).toBe("/x/reservar");
  });
});

describe("etiquetaDia", () => {
  it("hoy, mañana y el resto con nombre del día", () => {
    expect(etiquetaDia("2030-03-06", "2030-03-06")).toBe("Hoy");
    expect(etiquetaDia("2030-03-07", "2030-03-06")).toBe("Mañana");
    expect(etiquetaDia("2030-03-11", "2030-03-06")).toBe("Lunes 11 de marzo");
  });

  it("cruza fin de mes y de año", () => {
    expect(etiquetaDia("2030-03-01", "2030-02-28")).toBe("Mañana");
    expect(etiquetaDia("2031-01-01", "2030-12-31")).toBe("Mañana");
  });
});
