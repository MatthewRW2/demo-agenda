import { describe, expect, it } from "vitest";
import { contraste, luminancia } from "./color";
import { derivarPaleta, mezclar, variablesDeMarca } from "./paleta";

const HEX = /^#[0-9a-f]{6}$/;

// Pares reales y casos extremos: oscuros, medios, claros, saturados, blanco y negro
const PARES: [string, string][] = [
  ["#1F2937", "#C8A24A"], // barbería de ejemplo
  ["#0F4C5C", "#F4B860"], // consultorio de ejemplo
  ["#3B82F6", "#F97316"], // azul medio
  ["#F5C518", "#111111"], // amarillo (el caso difícil)
  ["#FFFFFF", "#000000"],
  ["#000000", "#FFFFFF"],
  ["#DC2626", "#FDE68A"], // rojo
  ["#7C3AED", "#A7F3D0"], // violeta
  ["#B7E4C7", "#2D6A4F"], // verde pastel (claro)
  ["#FF00FF", "#00FFFF"], // saturados
  ["#777777", "#888888"], // gris medio
];

describe("mezclar (OKLab)", () => {
  it("t=0 y t=1 devuelven los extremos", () => {
    expect(mezclar("#1f2937", "#c8a24a", 0)).toBe("#1f2937");
    expect(mezclar("#1f2937", "#c8a24a", 1)).toBe("#c8a24a");
  });

  it("negro y blanco al 50 % da un gris intermedio, ni más claro ni más oscuro que sus extremos", () => {
    const medio = mezclar("#000000", "#ffffff", 0.5);
    expect(medio).toMatch(HEX);
    expect(luminancia(medio)).toBeGreaterThan(0);
    expect(luminancia(medio)).toBeLessThan(1);
  });
});

describe.each(PARES)("derivarPaleta(%s, %s)", (primario, acento) => {
  const p = derivarPaleta(primario, acento);

  it("devuelve colores hexadecimales válidos", () => {
    for (const valor of Object.values(p)) expect(valor).toMatch(HEX);
  });

  it("el texto principal tiene al menos 7:1 sobre el papel y la superficie", () => {
    expect(contraste(p.tinta, p.papel)).toBeGreaterThanOrEqual(7);
    expect(contraste(p.tinta, p.papel2)).toBeGreaterThanOrEqual(7);
  });

  it("el texto secundario y el primario como texto tienen al menos 4,5:1", () => {
    expect(contraste(p.tintaSuave, p.papel)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p.tintaSuave, p.papel2)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p.primarioTexto, p.papel)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p.primarioTexto, p.papel2)).toBeGreaterThanOrEqual(4.5);
  });

  it("el borde de los controles tiene al menos 3:1 sobre el papel", () => {
    expect(contraste(p.bordeControl, p.papel)).toBeGreaterThanOrEqual(3);
  });

  it("el papel es más claro que la superficie, y esta más que la línea", () => {
    expect(luminancia(p.papel)).toBeGreaterThanOrEqual(luminancia(p.papel2));
    expect(luminancia(p.papel2)).toBeGreaterThanOrEqual(luminancia(p.linea) - 0.0001);
    expect(luminancia(p.papel)).toBeGreaterThan(0.85);
  });
});

describe("variablesDeMarca", () => {
  it("incluye los colores base, el texto sobre cada uno y la paleta derivada", () => {
    const v = variablesDeMarca({ primario: "#1F2937", acento: "#C8A24A" });
    expect(Object.keys(v).sort()).toEqual(
      [
        "--acento",
        "--borde-control",
        "--linea",
        "--papel",
        "--papel-2",
        "--primario",
        "--primario-texto",
        "--sobre-acento",
        "--sobre-primario",
        "--tinta",
        "--tinta-suave",
      ].sort(),
    );
    expect(v["--primario"]).toBe("#1F2937");
    expect(v["--sobre-primario"]).toBe("#ffffff");
    expect(v["--sobre-acento"]).toBe("#111111");
  });

  it("con un primario claro, el texto del primario se oscurece solo (ya no hace falta un aviso)", () => {
    const v = variablesDeMarca({ primario: "#F5C518", acento: "#111111" });
    expect(contraste(v["--primario-texto"], v["--papel"])).toBeGreaterThanOrEqual(4.5);
    expect(v["--primario-texto"]).not.toBe("#F5C518");
  });
});
