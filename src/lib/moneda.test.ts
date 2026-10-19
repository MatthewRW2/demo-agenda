import { describe, expect, it } from "vitest";
import { formatearCOP } from "./moneda";

describe("formatearCOP", () => {
  it("usa separador de miles colombiano y sin decimales", () => {
    expect(formatearCOP(25000).replace(/\s/g, " ")).toMatch(/^\$ ?25\.000$/);
  });
});
