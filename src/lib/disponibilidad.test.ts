import { describe, expect, it } from "vitest";
import {
  calcularHorarios,
  diaDeSemana,
  diasDisponibles,
  hoyEnBogota,
  sumarDias,
  type BloqueoHorario,
  type ReservaOcupada,
} from "./disponibilidad";
import type { Tenant } from "./tenants/schema";

const tenant: Tenant = {
  slug: "prueba",
  nombre: "Barbería de Prueba",
  eslogan: "Para las pruebas",
  logo: "/logo.svg",
  colores: { primario: "#111111", acento: "#c8a24a" },
  whatsapp: "573001234567",
  direccion: "Calle 1 #2-3, Bogotá",
  horario: {
    lun: ["09:00", "19:00"],
    mar: ["09:00", "19:00"],
    mie: ["09:00", "19:00"],
    jue: ["09:00", "19:00"],
    vie: ["09:00", "20:00"],
    sab: ["08:00", "18:00"],
    dom: null,
  },
  intervaloMin: 15,
  anticipacionMinHoras: 2,
  diasReservables: 14,
  servicios: [
    { id: "corte", nombre: "Corte", duracionMin: 30, precio: 25000 },
    { id: "corte-barba", nombre: "Corte + barba", duracionMin: 50, precio: 40000 },
    { id: "nino", nombre: "Corte niño", duracionMin: 25, precio: 20000 },
  ],
  profesionales: [
    { id: "carlos", nombre: "Carlos", servicios: ["corte", "corte-barba"] },
    { id: "andres", nombre: "Andrés", servicios: ["corte", "corte-barba", "nino"] },
    { id: "mateo", nombre: "Mateo", servicios: ["corte", "nino"] },
  ],
  textos: { profesional: "barbero", reserva: "cita" },
  demo: true,
};

const corte = tenant.servicios[0];
const corteBarba = tenant.servicios[1];
const nino = tenant.servicios[2];

/** Instante UTC de una hora de pared en Bogotá (UTC-5 todo el año). */
const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);

// Viernes 1 de marzo de 2030, 10:00 en Bogotá.
const AHORA = bogota("2030-03-01", "10:00");
const LUNES = "2030-03-04";
const SABADO = "2030-03-02";

function reserva(
  professionalId: string,
  fecha: string,
  desde: string,
  hasta: string,
  status = "confirmada",
): ReservaOcupada {
  return { professionalId, startsAt: bogota(fecha, desde), endsAt: bogota(fecha, hasta), status };
}

function bloqueo(
  professionalId: string | null,
  fecha: string,
  desde: string,
  hasta: string,
): BloqueoHorario {
  return { professionalId, startsAt: bogota(fecha, desde), endsAt: bogota(fecha, hasta) };
}

const horas = (h: { hora: string }[]) => h.map((x) => x.hora);

describe("horario del local", () => {
  it("día cerrado (domingo) no tiene horarios", () => {
    expect(calcularHorarios(tenant, corte, "carlos", "2030-03-03", [], [], AHORA)).toEqual([]);
  });

  it("genera los inicios cada intervalo, desde la apertura hasta que el servicio quepa", () => {
    const h = horas(calcularHorarios(tenant, corte, "carlos", LUNES, [], [], AHORA));
    expect(h).toHaveLength(39);
    expect(h[0]).toBe("09:00");
    expect(h[1]).toBe("09:15");
    expect(h.at(-1)).toBe("18:30"); // 18:30 + 30 min = 19:00, justo el cierre
  });

  it("devuelve los horarios en orden ascendente y sin repetir", () => {
    const h = horas(calcularHorarios(tenant, corte, "cualquiera", LUNES, [], [], AHORA));
    expect(h).toEqual([...new Set(h)].sort());
  });

  it("un servicio que no cabe antes del cierre no ofrece ese inicio", () => {
    // Sábado cierra 18:00; corte + barba dura 50 min
    const h = horas(calcularHorarios(tenant, corteBarba, "carlos", SABADO, [], [], AHORA));
    expect(h.at(-1)).toBe("17:00"); // termina 17:50
    expect(h).not.toContain("17:15"); // terminaría 18:05
  });

  it("un servicio más largo que la jornada no tiene horarios", () => {
    const largo = { id: "corte", nombre: "Largo", duracionMin: 700, precio: 1 };
    expect(calcularHorarios(tenant, largo, "carlos", LUNES, [], [], AHORA)).toEqual([]);
  });

  it("respeta un intervalo distinto", () => {
    const t = { ...tenant, intervaloMin: 20 };
    const h = horas(calcularHorarios(t, corte, "carlos", LUNES, [], [], AHORA));
    expect(h.slice(0, 3)).toEqual(["09:00", "09:20", "09:40"]);
  });

  it("cada horario trae inicio y fin en UTC según la duración", () => {
    const [primero] = calcularHorarios(tenant, corte, "carlos", "2030-03-08", [], [], AHORA);
    expect(primero.hora).toBe("09:00");
    expect(primero.inicio.toISOString()).toBe("2030-03-08T14:00:00.000Z");
    expect(primero.fin.toISOString()).toBe("2030-03-08T14:30:00.000Z");
    expect(primero.profesionalId).toBe("carlos");
  });
});

describe("reservas existentes", () => {
  const reservas = [reserva("carlos", LUNES, "10:00", "10:30")];

  it("quita los inicios que se traslapan, y deja los contiguos", () => {
    const h = horas(calcularHorarios(tenant, corte, "carlos", LUNES, reservas, [], AHORA));
    expect(h).not.toContain("09:45"); // terminaría 10:15
    expect(h).not.toContain("10:00");
    expect(h).not.toContain("10:15");
    expect(h).toContain("09:30"); // termina justo a las 10:00
    expect(h).toContain("10:30"); // empieza justo cuando la otra termina
  });

  it("tiene en cuenta la duración del servicio al mirar hacia atrás", () => {
    const h = horas(calcularHorarios(tenant, corteBarba, "carlos", LUNES, reservas, [], AHORA));
    expect(h).not.toContain("09:15"); // 50 min -> 10:05
    expect(h).toContain("09:00"); // 09:50
  });

  it("una reserva cancelada no ocupa el horario", () => {
    const canceladas = [reserva("carlos", LUNES, "10:00", "10:30", "cancelada")];
    const h = horas(calcularHorarios(tenant, corte, "carlos", LUNES, canceladas, [], AHORA));
    expect(h).toContain("10:00");
  });

  it("completada y no_asistio sí siguen ocupando", () => {
    for (const status of ["completada", "no_asistio"]) {
      const r = [reserva("carlos", LUNES, "10:00", "10:30", status)];
      const h = horas(calcularHorarios(tenant, corte, "carlos", LUNES, r, [], AHORA));
      expect(h, status).not.toContain("10:00");
    }
  });

  it("las reservas de otro profesional no afectan", () => {
    const h = horas(calcularHorarios(tenant, corte, "mateo", LUNES, reservas, [], AHORA));
    expect(h).toContain("10:00");
  });

  it("una reserva de otro día no afecta", () => {
    const otroDia = [reserva("carlos", "2030-03-05", "10:00", "10:30")];
    const h = horas(calcularHorarios(tenant, corte, "carlos", LUNES, otroDia, [], AHORA));
    expect(h).toContain("10:00");
  });
});

describe("bloqueos", () => {
  it("un bloqueo de todo el local afecta a todos", () => {
    const b = [bloqueo(null, LUNES, "12:00", "14:00")];
    for (const p of ["carlos", "andres", "mateo"]) {
      const h = horas(calcularHorarios(tenant, corte, p, LUNES, [], b, AHORA));
      expect(h, p).toContain("11:30");
      expect(h, p).not.toContain("11:45");
      expect(h, p).not.toContain("13:45");
      expect(h, p).toContain("14:00");
    }
  });

  it("un bloqueo de un profesional solo afecta a ese profesional", () => {
    const b = [bloqueo("andres", LUNES, "12:00", "14:00")];
    expect(horas(calcularHorarios(tenant, corte, "andres", LUNES, [], b, AHORA))).not.toContain(
      "12:00",
    );
    expect(horas(calcularHorarios(tenant, corte, "carlos", LUNES, [], b, AHORA))).toContain(
      "12:00",
    );
  });

  it("con 'cualquiera', un bloqueo individual no quita el horario si otro está libre", () => {
    const b = [bloqueo("andres", LUNES, "12:00", "14:00")];
    const h = calcularHorarios(tenant, corte, "cualquiera", LUNES, [], b, AHORA);
    const a = h.find((x) => x.hora === "12:00");
    expect(a).toBeDefined();
    expect(a?.profesionalId).not.toBe("andres");
  });
});

describe("anticipación mínima y días reservables", () => {
  it("no ofrece horarios dentro de la anticipación mínima; el límite exacto sí", () => {
    const ahora = bogota(LUNES, "09:30"); // + 2 h = 11:30
    const h = horas(calcularHorarios(tenant, corte, "carlos", LUNES, [], [], ahora));
    expect(h[0]).toBe("11:30");
  });

  it("un minuto después del límite, el siguiente inicio", () => {
    const ahora = bogota(LUNES, "09:31");
    const h = horas(calcularHorarios(tenant, corte, "carlos", LUNES, [], [], ahora));
    expect(h[0]).toBe("11:45");
  });

  it("hoy sigue siendo reservable con los horarios que quedan", () => {
    const h = horas(calcularHorarios(tenant, corte, "carlos", "2030-03-01", [], [], AHORA));
    expect(h[0]).toBe("12:00"); // 10:00 + 2 h
  });

  it("un día pasado no tiene horarios", () => {
    expect(calcularHorarios(tenant, corte, "carlos", "2030-02-28", [], [], AHORA)).toEqual([]);
  });

  it("el último día de la ventana sí; el siguiente no", () => {
    // hoy = vie 1 mar; con 14 días, el último es jue 14 mar
    expect(calcularHorarios(tenant, corte, "carlos", "2030-03-14", [], [], AHORA)).not.toEqual([]);
    expect(calcularHorarios(tenant, corte, "carlos", "2030-03-15", [], [], AHORA)).toEqual([]);
  });

  it("diasDisponibles lista la ventana sin los días cerrados", () => {
    const d = diasDisponibles(tenant, AHORA);
    expect(d[0]).toBe("2030-03-01");
    expect(d.at(-1)).toBe("2030-03-14");
    expect(d).not.toContain("2030-03-03"); // domingo
    expect(d).not.toContain("2030-03-10"); // domingo
    expect(d).toHaveLength(12);
  });
});

describe("Bogotá frente a UTC", () => {
  it("hoyEnBogota usa el reloj de Bogotá, no el de UTC", () => {
    // 03:00Z del martes 5 = 22:00 del lunes 4 en Bogotá
    expect(hoyEnBogota(new Date("2030-03-05T03:00:00Z"))).toBe("2030-03-04");
    expect(hoyEnBogota(new Date("2030-03-05T05:00:00Z"))).toBe("2030-03-05"); // 00:00 en Bogotá
    expect(hoyEnBogota(new Date("2030-03-05T04:59:59Z"))).toBe("2030-03-04");
  });

  it("de noche en Bogotá (ya es el día siguiente en UTC), 'hoy' no ofrece nada y mañana sí", () => {
    const ahora = new Date("2030-03-05T03:00:00Z"); // lunes 22:00 en Bogotá
    expect(calcularHorarios(tenant, corte, "carlos", LUNES, [], [], ahora)).toEqual([]);
    const manana = calcularHorarios(tenant, corte, "carlos", "2030-03-05", [], [], ahora);
    expect(manana[0].hora).toBe("09:00");
  });

  it("una cita al cierre que en UTC cae al día siguiente ocupa el día correcto", () => {
    // Viernes 8 mar 19:30-20:00 Bogotá = sábado 9 mar 00:30-01:00 UTC
    const tarde: ReservaOcupada = {
      professionalId: "carlos",
      startsAt: new Date("2030-03-09T00:30:00Z"),
      endsAt: new Date("2030-03-09T01:00:00Z"),
      status: "confirmada",
    };
    const viernes = horas(
      calcularHorarios(tenant, corte, "carlos", "2030-03-08", [tarde], [], AHORA),
    );
    expect(viernes).toContain("19:00");
    expect(viernes).not.toContain("19:15");
    expect(viernes).not.toContain("19:30");

    // El sábado de Bogotá no se ve afectado por una fecha UTC que "parece" sábado
    const sabado = horas(
      calcularHorarios(tenant, corte, "carlos", "2030-03-09", [tarde], [], AHORA),
    );
    expect(sabado[0]).toBe("08:00");
    expect(sabado).toHaveLength(39); // 08:00-18:00, corte de 30 min, cada 15
  });

  it("diaDeSemana y sumarDias no dependen de la zona del servidor", () => {
    expect(diaDeSemana("2030-03-04")).toBe("lun");
    expect(diaDeSemana("2030-03-03")).toBe("dom");
    expect(diaDeSemana("2030-03-09")).toBe("sab");
    expect(sumarDias("2030-02-28", 1)).toBe("2030-03-01");
    expect(sumarDias("2030-12-31", 1)).toBe("2031-01-01");
    expect(sumarDias("2030-03-01", -1)).toBe("2030-02-28");
  });
});

describe("profesional 'cualquiera'", () => {
  it("une la disponibilidad de quienes hacen el servicio (solo andres y mateo hacen 'nino')", () => {
    const h = calcularHorarios(tenant, nino, "cualquiera", LUNES, [], [], AHORA);
    expect(new Set(h.map((x) => x.profesionalId))).toEqual(new Set(["andres"])); // empate -> primero del JSON
    expect(h[0].hora).toBe("09:00");
  });

  it("nunca asigna a un profesional que no hace el servicio", () => {
    const h = calcularHorarios(tenant, nino, "cualquiera", LUNES, [], [], AHORA);
    expect(h.every((x) => x.profesionalId !== "carlos")).toBe(true);
  });

  it("asigna al menos ocupado del día", () => {
    // Andrés tiene 60 min reservados, Mateo 30
    const r = [
      reserva("andres", LUNES, "14:00", "15:00"),
      reserva("mateo", LUNES, "16:00", "16:30"),
    ];
    const h = calcularHorarios(tenant, nino, "cualquiera", LUNES, r, [], AHORA);
    expect(h.find((x) => x.hora === "09:00")?.profesionalId).toBe("mateo");
  });

  it("si el menos ocupado no está libre a esa hora, asigna al otro", () => {
    const r = [
      reserva("andres", LUNES, "14:00", "15:00"),
      reserva("mateo", LUNES, "16:00", "16:30"),
      reserva("mateo", LUNES, "10:00", "10:30"),
    ];
    // Cargas: andres 60, mateo 60 -> empate; a las 10:00 mateo está ocupado -> andres
    const h = calcularHorarios(tenant, nino, "cualquiera", LUNES, r, [], AHORA);
    expect(h.find((x) => x.hora === "10:00")?.profesionalId).toBe("andres");
  });

  it("el horario desaparece solo cuando todos están ocupados", () => {
    const r = [
      reserva("andres", LUNES, "11:00", "11:30"),
      reserva("mateo", LUNES, "11:00", "11:30"),
    ];
    const h = horas(calcularHorarios(tenant, nino, "cualquiera", LUNES, r, [], AHORA));
    expect(h).not.toContain("11:00");
    expect(h).toContain("10:30"); // 10:30-10:55: ambos libres
    expect(h).toContain("11:30");
  });

  it("con un solo ocupado, el horario sigue disponible con el otro", () => {
    const r = [reserva("andres", LUNES, "11:00", "11:30")];
    const a = calcularHorarios(tenant, nino, "cualquiera", LUNES, r, [], AHORA).find(
      (x) => x.hora === "11:00",
    );
    expect(a?.profesionalId).toBe("mateo");
  });

  it("con servicio que hacen los tres, devuelve cada hora una sola vez", () => {
    const h = horas(calcularHorarios(tenant, corte, "cualquiera", LUNES, [], [], AHORA));
    expect(h).toHaveLength(39);
  });
});

describe("profesional concreto", () => {
  it("si no hace ese servicio, no hay horarios", () => {
    expect(calcularHorarios(tenant, corteBarba, "mateo", LUNES, [], [], AHORA)).toEqual([]);
  });

  it("un profesional que no existe no tiene horarios", () => {
    expect(calcularHorarios(tenant, corte, "zoe", LUNES, [], [], AHORA)).toEqual([]);
  });
});

describe("entradas inválidas", () => {
  it.each(["04/03/2030", "2030-3-4", "2030-02-31", "mañana", ""])("rechaza la fecha %j", (f) => {
    expect(() => calcularHorarios(tenant, corte, "carlos", f, [], [], AHORA)).toThrow(
      /Fecha inválida/,
    );
  });
});
