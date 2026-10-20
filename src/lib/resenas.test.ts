import { describe, expect, it } from "vitest";
import { RESENAS_DE_EJEMPLO, resenasParaMostrar } from "./resenas";

const real = [{ autor: "Camila P.", texto: "Excelente atención.", estrellas: 5, fuente: "Google" }];

describe("resenasParaMostrar", () => {
  it("las reseñas reales del JSON mandan, también en una demo", () => {
    expect(resenasParaMostrar({ resenas: real, demo: true })).toEqual({
      resenas: real,
      esEjemplo: false,
    });
    expect(resenasParaMostrar({ resenas: real, demo: false })).toEqual({
      resenas: real,
      esEjemplo: false,
    });
  });

  it("una demo sin reseñas propias muestra las de ejemplo, marcadas como tales", () => {
    const r = resenasParaMostrar({ resenas: undefined, demo: true });
    expect(r?.esEjemplo).toBe(true);
    expect(r?.resenas).toBe(RESENAS_DE_EJEMPLO);
    expect(resenasParaMostrar({ resenas: [], demo: true })?.esEjemplo).toBe(true);
  });

  it("un negocio real sin reseñas no muestra la sección (nunca inventa)", () => {
    expect(resenasParaMostrar({ resenas: undefined, demo: false })).toBeNull();
    expect(resenasParaMostrar({ resenas: [], demo: false })).toBeNull();
  });

  it("las de ejemplo van rotuladas y no afirman nada del servicio de un negocio", () => {
    for (const r of RESENAS_DE_EJEMPLO) {
      expect(r.fuente).toBe("Ejemplo");
      expect(r.estrellas).toBeGreaterThanOrEqual(1);
      expect(r.estrellas).toBeLessThanOrEqual(5);
      expect(r.texto).not.toMatch(/corte|barba|diente|limpieza|masaje|tratamiento/i);
    }
  });
});
