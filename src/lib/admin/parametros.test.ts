import { describe, expect, it } from "vitest";
import { fechaValida, unico } from "./parametros";

describe("parámetros de la URL", () => {
  it("unico toma el primero de una lista", () => {
    expect(unico(["a", "b"])).toBe("a");
    expect(unico("a")).toBe("a");
    expect(unico(undefined)).toBeUndefined();
  });

  it.each([
    ["2030-03-04", "2030-03-04"],
    ["2030-02-31", undefined],
    ["2030-13-01", undefined],
    ["04/03/2030", undefined],
    ["", undefined],
    [undefined, undefined],
    ["<script>", undefined],
  ])("fechaValida(%j) = %j", (entrada, esperado) => {
    expect(fechaValida(entrada)).toBe(esperado);
  });
});
