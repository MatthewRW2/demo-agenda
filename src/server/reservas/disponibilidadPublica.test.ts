import { describe, expect, it, vi } from "vitest";
import type { BloqueoHorario, ReservaOcupada } from "@/lib/disponibilidad";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import { disponibilidadPublica } from "./disponibilidadPublica";

const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const MIERCOLES = "2030-03-06";

function repo(reservas: ReservaOcupada[] = [], bloqueos: BloqueoHorario[] = []) {
  const enRango = <T extends { startsAt: Date; endsAt: Date }>(
    lista: T[],
    desde: Date,
    hasta: Date,
  ) => lista.filter((x) => x.startsAt < hasta && x.endsAt > desde);
  return {
    reservasDelDia: vi.fn(async (_slug: string, desde: Date, hasta: Date) =>
      enRango(reservas, desde, hasta),
    ),
    bloqueosDelDia: vi.fn(async (_slug: string, desde: Date, hasta: Date) =>
      enRango(bloqueos, desde, hasta),
    ),
  };
}

describe("disponibilidadPublica", () => {
  const t = tenantDePrueba; // anticipación 2 h; carlos/andres/mateo; primer servicio: corte (30 min)

  it("con todo libre, el próximo turno es hoy respetando la anticipación y hay 4 horas distintas", async () => {
    const d = await disponibilidadPublica(repo(), t, bogota(MIERCOLES, "11:00"));
    expect(d.fechaHoy).toBe(MIERCOLES);
    expect(d.proximo?.fecha).toBe(MIERCOLES);
    expect(d.proximo?.turnos.map((x) => x.hora)).toEqual(["13:00", "13:15", "13:30", "13:45"]);
    expect(Object.values(d.hoy)).toEqual([true, true, true]);
  });

  it("cada turno trae el servicio principal del profesional que lo ofrece (el primero en el JSON)", async () => {
    const d = await disponibilidadPublica(repo(), t, bogota(MIERCOLES, "11:00"));
    expect(d.proximo?.turnos[0]).toEqual({
      hora: "13:00",
      servicioId: "corte",
      profesionalId: "carlos",
    });
  });

  it("si un profesional está ocupado, otro cubre el horario y él figura sin turnos hoy", async () => {
    const bloqueoCarlos: BloqueoHorario = {
      professionalId: "carlos",
      startsAt: bogota(MIERCOLES, "00:00"),
      endsAt: bogota(MIERCOLES, "23:59"),
    };
    const d = await disponibilidadPublica(repo([], [bloqueoCarlos]), t, bogota(MIERCOLES, "11:00"));
    expect(d.hoy).toEqual({ carlos: false, andres: true, mateo: true });
    expect(d.proximo?.turnos[0]).toEqual({
      hora: "13:00",
      servicioId: "corte",
      profesionalId: "andres",
    });
  });

  it("cuando ya no quedan turnos hoy, muestra el primero de mañana y todos 'sin turnos hoy'", async () => {
    const d = await disponibilidadPublica(repo(), t, bogota(MIERCOLES, "18:30"));
    expect(d.hoy).toEqual({ carlos: false, andres: false, mateo: false });
    expect(d.proximo?.fecha).toBe("2030-03-07");
    expect(d.proximo?.turnos[0].hora).toBe("09:00");
  });

  it("un sábado por la tarde el próximo turno es el lunes (el domingo cierra)", async () => {
    const d = await disponibilidadPublica(repo(), t, bogota("2030-03-09", "17:30"));
    expect(d.proximo?.fecha).toBe("2030-03-11");
  });

  it("un local cerrado todo el día no tiene turnos hoy y busca en los días siguientes", async () => {
    const d = await disponibilidadPublica(repo(), t, bogota("2030-03-10", "10:00")); // domingo
    expect(Object.values(d.hoy)).toEqual([false, false, false]);
    expect(d.proximo?.fecha).toBe("2030-03-11");
  });

  it("si no hay nada en toda la ventana reservable, el próximo es null", async () => {
    const un = { ...t, diasReservables: 1 };
    const todoElDia: BloqueoHorario = {
      professionalId: null,
      startsAt: bogota(MIERCOLES, "00:00"),
      endsAt: bogota(MIERCOLES, "23:59"),
    };
    const d = await disponibilidadPublica(repo([], [todoElDia]), un, bogota(MIERCOLES, "08:00"));
    expect(d.proximo).toBeNull();
    expect(Object.values(d.hoy)).toEqual([false, false, false]);
  });

  it("se detiene en el primer día con turnos (no consulta toda la ventana)", async () => {
    const r = repo();
    await disponibilidadPublica(r, t, bogota(MIERCOLES, "11:00"));
    expect(r.reservasDelDia).toHaveBeenCalledTimes(1);
    const r2 = repo();
    await disponibilidadPublica(r2, t, bogota(MIERCOLES, "18:30")); // hoy no, mañana sí
    expect(r2.reservasDelDia).toHaveBeenCalledTimes(2);
  });

  it("una reserva existente quita ese horario del próximo turno", async () => {
    const ocupada = (profesionalId: string): ReservaOcupada => ({
      professionalId: profesionalId,
      startsAt: bogota(MIERCOLES, "13:00"),
      endsAt: bogota(MIERCOLES, "13:30"),
      status: "confirmada",
    });
    const d = await disponibilidadPublica(
      repo(["carlos", "andres", "mateo"].map(ocupada)),
      t,
      bogota(MIERCOLES, "11:00"),
    );
    // 13:15 dura hasta las 13:45 y se cruza con las reservas de 13:00 a 13:30: el primero libre es 13:30
    expect(d.proximo?.turnos[0].hora).toBe("13:30");
  });

  it("funciona con un solo profesional", async () => {
    const solo = { ...t, profesionales: [t.profesionales[0]] };
    const d = await disponibilidadPublica(repo(), solo, bogota(MIERCOLES, "11:00"));
    expect(Object.keys(d.hoy)).toEqual(["carlos"]);
    expect(d.proximo?.turnos).toHaveLength(4);
  });
});
