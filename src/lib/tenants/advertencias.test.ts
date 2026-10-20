import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import { advertenciasDeTenant } from "./advertencias";
import { cargarTenant, validarTenant } from "./cargar";
import type { Tenant } from "./schema";

describe("advertenciasDeTenant", () => {
  it("un negocio bien armado no tiene avisos", () => {
    expect(advertenciasDeTenant(tenantDePrueba)).toEqual([]);
    expect(advertenciasDeTenant(cargarTenant("don-carlos")!)).toEqual([]);
  });

  it("la plantilla sin tocar avisa de todos sus valores de relleno", () => {
    const plantilla = validarTenant(
      JSON.parse(readFileSync(path.join(process.cwd(), "tenants", "_plantilla.json"), "utf8")),
      "_plantilla.json",
    );
    const avisos = advertenciasDeTenant(plantilla).join("\n");
    for (const esperado of [
      "nombre:",
      "eslogan:",
      "direccion:",
      "whatsapp:",
      "instagram:",
      "servicios[0].nombre",
      "servicios[1].nombre",
      "profesionales[0].nombre",
    ]) {
      expect(avisos, esperado).toContain(esperado);
    }
  });

  it("una demo sin contactoDemo no avisa de nada: simplemente no muestra botones de contacto", () => {
    expect(advertenciasDeTenant({ ...tenantDePrueba, contactoDemo: undefined })).toEqual([]);
  });

  it("no avisa por colores: la paleta se deriva sola y funciona con cualquier par", () => {
    for (const colores of [
      { primario: "#f5c518", acento: "#111111" },
      { primario: "#0f4c5c", acento: "#f4b860" },
    ]) {
      expect(advertenciasDeTenant({ ...tenantDePrueba, colores })).toEqual([]);
    }
  });

  it("avisa de un servicio que no cabe en ninguna jornada", () => {
    const t: Tenant = {
      ...tenantDePrueba,
      servicios: [
        ...tenantDePrueba.servicios,
        { id: "largo", nombre: "Tratamiento largo", duracionMin: 700, precio: 1 },
      ],
      profesionales: tenantDePrueba.profesionales.map((p) => ({
        ...p,
        servicios: [...p.servicios, "largo"],
      })),
    };
    const avisos = advertenciasDeTenant(t);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/Tratamiento largo.*700 min.*nadie podrá reservarlo/);
  });

  it.each([
    ["turno", true],
    ["encuentro", true],
    ["cita", false],
    ["consulta", false],
    ["sesión", false],
    ["reserva", false],
  ])("textos.reserva %j: aviso de concordancia = %s", (palabra, avisa) => {
    const t: Tenant = {
      ...tenantDePrueba,
      textos: { ...tenantDePrueba.textos, reserva: palabra as string },
    };
    expect(advertenciasDeTenant(t).some((a) => a.includes("suena masculino"))).toBe(avisa);
  });

  it("un número de WhatsApp o dirección reales no disparan el aviso", () => {
    const t: Tenant = {
      ...tenantDePrueba,
      whatsapp: "573102345678",
      direccion: "Cra. 7 #116-50, Bogotá",
    };
    expect(advertenciasDeTenant(t)).toEqual([]);
  });
});
