import { describe, expect, it } from "vitest";
import { preseleccionDesdeConsulta } from "./preseleccion";

const tenant = {
  servicios: [
    { id: "corte", nombre: "Corte", duracionMin: 30, precio: 1000 },
    { id: "barba", nombre: "Barba", duracionMin: 30, precio: 1000 },
  ],
  profesionales: [
    { id: "ana", nombre: "Ana", servicios: ["corte"] },
    { id: "luis", nombre: "Luis", servicios: ["corte", "barba"] },
  ],
};
const dias = ["2026-10-20", "2026-10-21"];

describe("preseleccionDesdeConsulta", () => {
  it("sin parámetros no elige nada", () => {
    expect(preseleccionDesdeConsulta(tenant, dias, {})).toEqual({});
  });

  it("acepta una cadena completa válida", () => {
    expect(
      preseleccionDesdeConsulta(tenant, dias, {
        servicio: "corte",
        profesional: "ana",
        fecha: "2026-10-20",
        hora: "15:30",
      }),
    ).toEqual({
      servicioId: "corte",
      profesionalId: "ana",
      fecha: "2026-10-20",
      hora: "15:30",
    });
  });

  it("solo profesional: lo deja elegido para escoger después el servicio", () => {
    expect(preseleccionDesdeConsulta(tenant, dias, { profesional: "ana", fecha: dias[0] })).toEqual(
      {
        profesionalId: "ana",
      },
    );
    expect(preseleccionDesdeConsulta(tenant, dias, { profesional: "nadie" })).toEqual({});
  });

  it("ignora un servicio que no existe, la fecha y la hora; conserva al profesional", () => {
    expect(
      preseleccionDesdeConsulta(tenant, dias, {
        servicio: "x",
        profesional: "ana",
        fecha: dias[0],
        hora: "10:00",
      }),
    ).toEqual({ profesionalId: "ana" });
  });

  it("ignora un profesional que no ofrece el servicio", () => {
    expect(
      preseleccionDesdeConsulta(tenant, dias, { servicio: "barba", profesional: "ana" }),
    ).toEqual({ servicioId: "barba" });
  });

  it("ignora una fecha fuera de los días reservables", () => {
    expect(
      preseleccionDesdeConsulta(tenant, dias, {
        servicio: "corte",
        profesional: "luis",
        fecha: "2026-10-01",
        hora: "10:00",
      }),
    ).toEqual({ servicioId: "corte", profesionalId: "luis" });
  });

  it("descarta una hora con formato inválido", () => {
    expect(
      preseleccionDesdeConsulta(tenant, dias, {
        servicio: "corte",
        profesional: "luis",
        fecha: dias[1],
        hora: "25:99",
      }).hora,
    ).toBeUndefined();
  });

  it("usa el primer valor si el parámetro se repite", () => {
    expect(preseleccionDesdeConsulta(tenant, dias, { servicio: ["barba", "corte"] })).toEqual({
      servicioId: "barba",
    });
  });
});
