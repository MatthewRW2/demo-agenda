import { describe, expect, it } from "vitest";
import { agruparPorMomento } from "./momentos";

describe("agruparPorMomento", () => {
  it("reparte en mañana, tarde y noche respetando los límites 12:00 y 18:00", () => {
    const g = agruparPorMomento(["09:00", "11:45", "12:00", "17:45", "18:00", "20:30"]);
    expect(g.map((x) => [x.titulo, x.horas])).toEqual([
      ["Mañana", ["09:00", "11:45"]],
      ["Tarde", ["12:00", "17:45"]],
      ["Noche", ["18:00", "20:30"]],
    ]);
  });

  it("omite los grupos sin horas y conserva el orden", () => {
    expect(agruparPorMomento(["14:00", "15:00"]).map((x) => x.momento)).toEqual(["tarde"]);
    expect(agruparPorMomento([])).toEqual([]);
  });
});
