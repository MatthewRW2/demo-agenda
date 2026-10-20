import { describe, expect, it } from "vitest";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import { agruparHorario, estadoApertura, textoApertura } from "./horario";
import type { Tenant } from "./tenants/schema";

const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
// Semana de prueba: lun-jue 09:00-19:00, vie 09:00-20:00, sáb 08:00-18:00, dom cerrado
const LUNES = "2030-03-04";
const VIERNES = "2030-03-08";
const SABADO = "2030-03-09";
const DOMINGO = "2030-03-10";

describe("agruparHorario", () => {
  it("junta los días consecutivos iguales", () => {
    expect(agruparHorario(tenantDePrueba.horario)).toEqual([
      { dias: "Lun–Jue", horas: "9:00 a. m.–7:00 p. m." },
      { dias: "Vie", horas: "9:00 a. m.–8:00 p. m." },
      { dias: "Sáb", horas: "8:00 a. m.–6:00 p. m." },
      { dias: "Dom", horas: null },
    ]);
  });

  it("un solo día distinto en medio parte el grupo; los cerrados también se juntan", () => {
    const h = { ...tenantDePrueba.horario, mie: ["10:00", "14:00"] as [string, string], sab: null };
    expect(agruparHorario(h).map((g) => g.dias)).toEqual([
      "Lun–Mar",
      "Mié",
      "Jue",
      "Vie",
      "Sáb–Dom",
    ]);
    expect(agruparHorario(h).at(-1)).toEqual({ dias: "Sáb–Dom", horas: null });
  });

  it("toda la semana igual es un solo grupo", () => {
    const igual: [string, string] = ["09:00", "17:00"];
    const h = {
      lun: igual,
      mar: igual,
      mie: igual,
      jue: igual,
      vie: igual,
      sab: igual,
      dom: igual,
    };
    expect(agruparHorario(h)).toEqual([{ dias: "Lun–Dom", horas: "9:00 a. m.–5:00 p. m." }]);
  });

  it("dos tramos iguales pero separados por un día distinto no se juntan", () => {
    const a: [string, string] = ["09:00", "12:00"];
    const b: [string, string] = ["14:00", "18:00"];
    const h = { lun: a, mar: b, mie: a, jue: b, vie: a, sab: null, dom: null };
    expect(agruparHorario(h)).toHaveLength(6);
  });
});

describe("estadoApertura y textoApertura", () => {
  const t = tenantDePrueba;

  it("abierto a media jornada: cierra a la hora del día", () => {
    const e = estadoApertura(t, bogota(LUNES, "15:30"));
    expect(e).toEqual({ estado: "abierto", cierra: "19:00" });
    expect(textoApertura(e)).toBe("Abierto ahora · cierra 7:00 p. m.");
  });

  it("el viernes cierra más tarde y el sábado abre más temprano", () => {
    expect(textoApertura(estadoApertura(t, bogota(VIERNES, "12:00")))).toBe(
      "Abierto ahora · cierra 8:00 p. m.",
    );
    expect(estadoApertura(t, bogota(SABADO, "08:00"))).toEqual({
      estado: "abierto",
      cierra: "18:00",
    });
  });

  it("el minuto exacto de apertura está abierto y el del cierre ya no", () => {
    expect(estadoApertura(t, bogota(LUNES, "09:00")).estado).toBe("abierto");
    expect(estadoApertura(t, bogota(LUNES, "18:59")).estado).toBe("abierto");
    expect(estadoApertura(t, bogota(LUNES, "19:00")).estado).toBe("cerrado");
  });

  it("antes de abrir: abre hoy", () => {
    const e = estadoApertura(t, bogota(LUNES, "07:15"));
    expect(e).toEqual({ estado: "cerrado", abre: { cuando: "hoy", hora: "09:00" } });
    expect(textoApertura(e)).toBe("Cerrado · abre hoy 9:00 a. m.");
  });

  it("después de cerrar: abre mañana", () => {
    const e = estadoApertura(t, bogota(LUNES, "21:00"));
    expect(textoApertura(e)).toBe("Cerrado · abre mañana 9:00 a. m.");
  });

  it("un sábado por la noche el negocio abre el lunes (el domingo cierra)", () => {
    const e = estadoApertura(t, bogota(SABADO, "20:00"));
    expect(e).toEqual({ estado: "cerrado", abre: { cuando: "lun", hora: "09:00" } });
    expect(textoApertura(e)).toBe("Cerrado · abre el lunes 9:00 a. m.");
  });

  it("un domingo cerrado todo el día: abre el lunes, que es mañana", () => {
    expect(textoApertura(estadoApertura(t, bogota(DOMINGO, "11:00")))).toBe(
      "Cerrado · abre mañana 9:00 a. m.",
    );
  });

  it("usa la hora de Bogotá, no la del servidor (03:00Z del martes son las 22:00 del lunes)", () => {
    const e = estadoApertura(t, new Date("2030-03-05T03:00:00Z"));
    expect(e.estado).toBe("cerrado");
    expect(textoApertura(e)).toBe("Cerrado · abre mañana 9:00 a. m.");
    // y 20:00Z del lunes son las 15:00 en Bogotá
    expect(estadoApertura(t, new Date("2030-03-04T20:00:00Z")).estado).toBe("abierto");
  });

  it("un negocio que no abre ningún día solo dice Cerrado", () => {
    const cerrado: Tenant = {
      ...t,
      horario: { lun: null, mar: null, mie: null, jue: null, vie: null, sab: null, dom: null },
    };
    const e = estadoApertura(cerrado, bogota(LUNES, "10:00"));
    expect(e).toEqual({ estado: "cerrado", abre: null });
    expect(textoApertura(e)).toBe("Cerrado");
  });
});
