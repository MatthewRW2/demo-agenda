import { describe, expect, it } from "vitest";
import { lunesDeLaSemana } from "@/lib/disponibilidad";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import { marcasDeHora, minutosDelDia, posicionEnAgenda, rangoVisible } from "./agenda";
import { calcularMetricas, type ReservaMetrica } from "./metricas";

const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const LUNES = "2030-03-04";

describe("lunesDeLaSemana", () => {
  it.each([
    ["2030-03-04", "2030-03-04"], // lunes
    ["2030-03-06", "2030-03-04"], // miércoles
    ["2030-03-10", "2030-03-04"], // domingo pertenece a la semana que empezó el lunes 4
    ["2030-03-11", "2030-03-11"],
    ["2030-01-01", "2029-12-31"], // cruza de año
  ])("%s -> %s", (fecha, lunes) => {
    expect(lunesDeLaSemana(fecha)).toBe(lunes);
  });
});

describe("agenda: franja visible y posiciones", () => {
  const t = tenantDePrueba; // lunes 09:00-19:00, domingo cerrado

  it("minutosDelDia cuenta desde la medianoche de Bogotá, no de UTC", () => {
    expect(minutosDelDia(bogota(LUNES, "00:00"), LUNES)).toBe(0);
    expect(minutosDelDia(bogota(LUNES, "09:30"), LUNES)).toBe(570);
    expect(minutosDelDia(new Date("2030-03-05T04:59:00Z"), LUNES)).toBe(1439); // 23:59 en Bogotá
  });

  it("minutosDelDia se acota al día (algo de otro día no se sale del rango)", () => {
    expect(minutosDelDia(bogota("2030-03-03", "22:00"), LUNES)).toBe(0);
    expect(minutosDelDia(bogota("2030-03-05", "02:00"), LUNES)).toBe(1440);
  });

  it("usa el horario del local, redondeado a horas completas", () => {
    expect(rangoVisible(t, LUNES, [])).toEqual({ desdeMin: 540, hastaMin: 1140 });
  });

  it("se amplía si hay una cita fuera del horario", () => {
    const fuera = { startsAt: bogota(LUNES, "07:30"), endsAt: bogota(LUNES, "08:00") };
    const tarde = { startsAt: bogota(LUNES, "19:15"), endsAt: bogota(LUNES, "20:10") };
    expect(rangoVisible(t, LUNES, [fuera])).toEqual({ desdeMin: 420, hastaMin: 1140 });
    expect(rangoVisible(t, LUNES, [tarde])).toEqual({ desdeMin: 540, hastaMin: 1260 });
  });

  it("día cerrado sin nada: null; con una cita: solo muestra esa franja", () => {
    expect(rangoVisible(t, "2030-03-03", [])).toBeNull(); // domingo
    const cita = { startsAt: bogota("2030-03-03", "10:00"), endsAt: bogota("2030-03-03", "10:30") };
    expect(rangoVisible(t, "2030-03-03", [cita])).toEqual({ desdeMin: 600, hastaMin: 660 });
  });

  it("posicionEnAgenda mide desde el inicio de la franja", () => {
    const cita = { startsAt: bogota(LUNES, "10:15"), endsAt: bogota(LUNES, "10:45") };
    expect(posicionEnAgenda(cita, LUNES, 540)).toEqual({ topMin: 75, altoMin: 30 });
  });

  it("marcasDeHora: una por hora, sin la del final", () => {
    expect(marcasDeHora(540, 780)).toEqual([540, 600, 660, 720]);
  });
});

describe("calcularMetricas", () => {
  const r = (
    serviceId: string,
    hora: string,
    status = "confirmada",
    fecha = LUNES,
  ): ReservaMetrica => ({
    serviceId,
    startsAt: bogota(fecha, hora),
    status,
  });

  it("sin reservas: todo en cero y sin 'más pedido'", () => {
    expect(calcularMetricas(tenantDePrueba, [])).toEqual({
      citas: 0,
      canceladas: 0,
      completadas: 0,
      inasistencias: 0,
      porcentajeInasistencias: null,
      ingresosEstimados: 0,
      servicioMasPedido: null,
      horaMasOcupada: null,
    });
  });

  it("cuenta citas sin canceladas, calcula el % de inasistencias sobre las resueltas", () => {
    const m = calcularMetricas(tenantDePrueba, [
      r("corte", "10:00", "completada"),
      r("corte", "11:00", "completada"),
      r("corte", "12:00", "completada"),
      r("corte", "13:00", "no_asistio"),
      r("corte", "14:00", "cancelada"),
      r("corte", "15:00", "confirmada"), // aún no resuelta: no entra en el %
    ]);
    expect(m.citas).toBe(5);
    expect(m.canceladas).toBe(1);
    expect(m.completadas).toBe(3);
    expect(m.inasistencias).toBe(1);
    expect(m.porcentajeInasistencias).toBe(25); // 1 de 4 resueltas
  });

  it("redondea el porcentaje a un decimal", () => {
    const m = calcularMetricas(tenantDePrueba, [
      r("corte", "10:00", "no_asistio"),
      r("corte", "11:00", "completada"),
      r("corte", "12:00", "completada"),
    ]);
    expect(m.porcentajeInasistencias).toBe(33.3);
  });

  it("sin ninguna cita resuelta el % es null (no 0)", () => {
    expect(
      calcularMetricas(tenantDePrueba, [r("corte", "10:00")]).porcentajeInasistencias,
    ).toBeNull();
  });

  it("ingresos: confirmadas y completadas; no inasistencias ni canceladas", () => {
    const m = calcularMetricas(tenantDePrueba, [
      r("corte", "10:00", "completada"), // 25.000
      r("corte-barba", "11:00", "confirmada"), // 40.000
      r("nino", "12:00", "no_asistio"), // no cuenta
      r("corte", "13:00", "cancelada"), // no cuenta
      r("servicio-que-ya-no-existe", "14:00", "completada"), // sin precio conocido: suma 0
    ]);
    expect(m.ingresosEstimados).toBe(65_000);
  });

  it("servicio más pedido ignora canceladas y desempata por el orden del JSON", () => {
    const m = calcularMetricas(tenantDePrueba, [
      r("nino", "10:00"),
      r("corte", "11:00"),
      r("corte", "12:00", "cancelada"),
      r("corte", "13:00", "cancelada"),
      r("corte", "14:00", "cancelada"),
    ]);
    // corte y nino empatan en 1 (las canceladas no cuentan): gana corte, que va antes en el JSON
    expect(m.servicioMasPedido).toEqual({ id: "corte", nombre: "Corte", cantidad: 1 });
  });

  it("servicio más pedido por cantidad", () => {
    const m = calcularMetricas(tenantDePrueba, [
      r("corte", "10:00"),
      r("nino", "11:00"),
      r("nino", "12:00"),
    ]);
    expect(m.servicioMasPedido).toEqual({ id: "nino", nombre: "Corte niño", cantidad: 2 });
  });

  it("hora más ocupada usa la hora de Bogotá y desempata por la más temprana", () => {
    const m = calcularMetricas(tenantDePrueba, [
      r("corte", "15:00"),
      r("corte", "15:30"),
      r("corte", "10:00"),
      r("corte", "10:45"),
      r("corte", "11:00"),
    ]);
    expect(m.horaMasOcupada).toEqual({ hora: 10, cantidad: 2 });
    // 15:00 y 15:30 también suman 2, pero la 10 va primero
  });

  it("una cita a las 23:30 de Bogotá (04:30Z del día siguiente) cuenta en la hora 23", () => {
    const m = calcularMetricas(tenantDePrueba, [
      { serviceId: "corte", startsAt: new Date("2030-03-05T04:30:00Z"), status: "confirmada" },
    ]);
    expect(m.horaMasOcupada).toEqual({ hora: 23, cantidad: 1 });
  });
});
