import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings } from "@/db/schema";
import type { BloqueoHorario, ReservaOcupada } from "@/lib/disponibilidad";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import type { EntradaReserva } from "@/lib/validacion";
import { crearRepositorio } from "./repositorio";
import {
  consultarHorarios,
  crearReserva,
  limitesDe,
  type ContextoReserva,
  type NuevaReservaWeb,
  type RepoReservas,
} from "./servicio";

const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const AHORA = bogota("2030-03-01", "10:00"); // viernes
const LUNES = "2030-03-04";

const tenant = { ...tenantDePrueba, demo: false };

let n = 0;
const contexto = (extra: Partial<ContextoReserva> = {}): ContextoReserva => ({
  ahora: AHORA,
  ipHash: "ip-1",
  generarToken: () => `token-${++n}`,
  ...extra,
});

const entrada = (extra: Partial<EntradaReserva> = {}): EntradaReserva => ({
  servicioId: "corte",
  profesionalId: "carlos",
  fecha: LUNES,
  hora: "10:00",
  nombre: "María Pérez",
  celular: "3001234567",
  ...extra,
});

/** Base de datos falsa en memoria que imita la restricción de exclusión de Postgres. */
function repoEnMemoria() {
  const filas: (NuevaReservaWeb & { id: string; status: string; creada: Date })[] = [];
  const bloqueos: BloqueoHorario[] = [];
  const estado = {
    antesDeInsertar: undefined as undefined | (() => void),
    errorAlInsertar: undefined as undefined | Error,
  };

  const repo: RepoReservas = {
    async reservasDelDia(slug, desde, hasta): Promise<ReservaOcupada[]> {
      return filas
        .filter((f) => f.tenantSlug === slug && f.status !== "cancelada")
        .filter((f) => f.startsAt < hasta && f.endsAt > desde)
        .map((f) => ({
          professionalId: f.professionalId,
          startsAt: f.startsAt,
          endsAt: f.endsAt,
          status: f.status,
        }));
    },
    async bloqueosDelDia() {
      return bloqueos;
    },
    async contarActivasFuturas(slug, celular, ahora) {
      return filas.filter(
        (f) =>
          f.tenantSlug === slug &&
          f.customerPhone === celular &&
          f.status === "confirmada" &&
          f.startsAt > ahora,
      ).length;
    },
    async contarPorIpDesde(ipHash, desde) {
      return filas.filter((f) => f.customerIpHash === ipHash && f.creada >= desde).length;
    },
    async insertar(datos) {
      estado.antesDeInsertar?.();
      estado.antesDeInsertar = undefined;
      if (estado.errorAlInsertar) throw estado.errorAlInsertar;
      const choca = filas.some(
        (f) =>
          f.tenantSlug === datos.tenantSlug &&
          f.professionalId === datos.professionalId &&
          f.status !== "cancelada" &&
          f.startsAt < datos.endsAt &&
          datos.startsAt < f.endsAt,
      );
      if (choca) throw Object.assign(new Error("conflicting key value"), { code: "23P01" });
      const id = `id-${filas.length + 1}`;
      filas.push({ ...datos, id, status: "confirmada", creada: AHORA });
      return { id };
    },
  };
  return { repo, filas, bloqueos, estado };
}

describe("crearReserva (base en memoria)", () => {
  let mem: ReturnType<typeof repoEnMemoria>;
  beforeEach(() => {
    mem = repoEnMemoria();
  });

  it("crea la reserva con el profesional, horas UTC y token generados en el servidor", async () => {
    const r = await crearReserva(mem.repo, tenant, entrada(), contexto());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reserva.profesionalId).toBe("carlos");
    expect(r.reserva.inicio.toISOString()).toBe("2030-03-04T15:00:00.000Z");
    expect(r.reserva.fin.toISOString()).toBe("2030-03-04T15:30:00.000Z");
    expect(r.reserva.manageToken).toMatch(/^token-/);
    expect(mem.filas).toHaveLength(1);
    expect(mem.filas[0]).toMatchObject({
      customerName: "María Pérez",
      customerPhone: "3001234567",
      customerEmail: null,
      customerIpHash: "ip-1",
    });
  });

  it("guarda el correo cuando lo dan", async () => {
    await crearReserva(mem.repo, tenant, entrada({ correo: "maria@correo.com" }), contexto());
    expect(mem.filas[0].customerEmail).toBe("maria@correo.com");
  });

  it("rechaza una hora que no está libre aunque el cliente la haya visto antes", async () => {
    await crearReserva(mem.repo, tenant, entrada(), contexto());
    const r = await crearReserva(mem.repo, tenant, entrada({ celular: "3009999999" }), contexto());
    expect(r).toEqual({ ok: false, codigo: "horario_ocupado" });
    expect(mem.filas).toHaveLength(1);
  });

  it.each(["08:00", "19:00", "10:07"])(
    "rechaza la hora %s que no está en la rejilla del negocio",
    async (hora) => {
      const r = await crearReserva(mem.repo, tenant, entrada({ hora }), contexto());
      expect(r).toEqual({ ok: false, codigo: "horario_ocupado" });
    },
  );

  it("respeta la anticipación mínima", async () => {
    const r = await crearReserva(
      mem.repo,
      tenant,
      entrada({ fecha: "2030-03-01", hora: "11:00" }), // viernes 11:00 con "ahora" 10:00 y 2 h
      contexto(),
    );
    expect(r).toEqual({ ok: false, codigo: "horario_ocupado" });
  });

  it("respeta los bloqueos", async () => {
    mem.bloqueos.push({
      professionalId: null,
      startsAt: bogota(LUNES, "09:00"),
      endsAt: bogota(LUNES, "12:00"),
    });
    const r = await crearReserva(mem.repo, tenant, entrada(), contexto());
    expect(r).toEqual({ ok: false, codigo: "horario_ocupado" });
  });

  it("servicio o profesional inexistentes", async () => {
    expect(
      await crearReserva(mem.repo, tenant, entrada({ servicioId: "tinte" }), contexto()),
    ).toEqual({
      ok: false,
      codigo: "servicio_invalido",
    });
    expect(
      await crearReserva(mem.repo, tenant, entrada({ profesionalId: "zoe" }), contexto()),
    ).toEqual({
      ok: false,
      codigo: "profesional_invalido",
    });
  });

  it("un profesional que no hace el servicio no ofrece horarios", async () => {
    const r = await crearReserva(
      mem.repo,
      tenant,
      entrada({ servicioId: "corte-barba", profesionalId: "mateo" }),
      contexto(),
    );
    expect(r).toEqual({ ok: false, codigo: "horario_ocupado" });
  });

  describe("carreras: dos personas eligen el mismo horario a la vez", () => {
    /** Simula que otra persona reserva justo antes de que se inserte la nuestra. */
    const adelantarse = (profesionalId: string) => () => {
      mem.filas.push({
        tenantSlug: tenant.slug,
        serviceId: "corte",
        professionalId: profesionalId,
        startsAt: bogota(LUNES, "10:00"),
        endsAt: bogota(LUNES, "10:30"),
        customerName: "Otra persona",
        customerPhone: "3110000000",
        customerEmail: null,
        manageToken: "otro",
        customerIpHash: null,
        id: "id-otro",
        status: "confirmada",
        creada: AHORA,
      });
    };

    it("con 'cualquiera', reintenta y consigue otro profesional libre", async () => {
      mem.estado.antesDeInsertar = adelantarse("carlos");
      const r = await crearReserva(
        mem.repo,
        tenant,
        entrada({ profesionalId: "cualquiera" }),
        contexto(),
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.reserva.profesionalId).not.toBe("carlos");
      expect(mem.filas).toHaveLength(2);
    });

    it("con un profesional concreto, responde horario_ocupado sin lanzar error", async () => {
      mem.estado.antesDeInsertar = adelantarse("carlos");
      const r = await crearReserva(mem.repo, tenant, entrada(), contexto());
      expect(r).toEqual({ ok: false, codigo: "horario_ocupado" });
      expect(mem.filas).toHaveLength(1);
    });
  });

  it("los errores que no son de traslape se propagan (no se esconden)", async () => {
    mem.estado.errorAlInsertar = new Error("conexión perdida");
    await expect(crearReserva(mem.repo, tenant, entrada(), contexto())).rejects.toThrow(
      "conexión perdida",
    );
  });

  describe("límites", () => {
    it("máximo de citas pendientes por celular (3 si no es demo)", async () => {
      for (const hora of ["09:00", "10:00", "11:00"]) {
        const r = await crearReserva(
          mem.repo,
          tenant,
          entrada({ hora }),
          contexto({ ipHash: null }),
        );
        expect(r.ok, hora).toBe(true);
      }
      const cuarta = await crearReserva(
        mem.repo,
        tenant,
        entrada({ hora: "12:00" }),
        contexto({ ipHash: null }),
      );
      expect(cuarta).toEqual({ ok: false, codigo: "limite_celular" });
      // otro celular sí puede
      const otro = await crearReserva(
        mem.repo,
        tenant,
        entrada({ hora: "12:00", celular: "3220000000" }),
        contexto({ ipHash: null }),
      );
      expect(otro.ok).toBe(true);
    });

    it("una cita cancelada o pasada no cuenta para el límite", async () => {
      for (const hora of ["09:00", "10:00", "11:00"]) {
        await crearReserva(mem.repo, tenant, entrada({ hora }), contexto({ ipHash: null }));
      }
      mem.filas[0].status = "cancelada";
      const r = await crearReserva(
        mem.repo,
        tenant,
        entrada({ hora: "12:00" }),
        contexto({ ipHash: null }),
      );
      expect(r.ok).toBe(true);
    });

    it("máximo de reservas por IP en una hora (10 si no es demo)", async () => {
      const profesionales = ["carlos", "andres", "mateo"];
      let creadas = 0;
      for (let i = 0; creadas < 10; i++) {
        const r = await crearReserva(
          mem.repo,
          tenant,
          entrada({
            hora: `${String(9 + Math.floor(i / 3)).padStart(2, "0")}:00`,
            profesionalId: profesionales[i % 3],
            celular: `3${String(100000000 + i)}`,
          }),
          contexto(),
        );
        expect(r.ok, `intento ${i}`).toBe(true);
        creadas++;
      }
      const siguiente = await crearReserva(
        mem.repo,
        tenant,
        entrada({ hora: "15:00", celular: "3200000000" }),
        contexto(),
      );
      expect(siguiente).toEqual({ ok: false, codigo: "limite_ip" });
      // sin IP conocida no se aplica ese límite, y otra IP tampoco está limitada
      expect(
        (
          await crearReserva(
            mem.repo,
            tenant,
            entrada({ hora: "15:00", celular: "3200000000" }),
            contexto({ ipHash: "ip-2" }),
          )
        ).ok,
      ).toBe(true);
    });

    it("en modo demo los límites son más holgados", () => {
      expect(limitesDe({ ...tenant, demo: true }).citasPendientesPorCelular).toBeGreaterThan(
        limitesDe({ ...tenant, demo: false }).citasPendientesPorCelular,
      );
    });
  });
});

describe("consultarHorarios", () => {
  it("devuelve los horarios libres y descarta lo ocupado", async () => {
    const mem = repoEnMemoria();
    await crearReserva(mem.repo, tenant, entrada(), contexto());
    const r = await consultarHorarios(
      mem.repo,
      tenant,
      { servicioId: "corte", profesionalId: "carlos", fecha: LUNES },
      AHORA,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const horas = r.horarios.map((h) => h.hora);
      expect(horas).toContain("09:30");
      expect(horas).not.toContain("10:00");
      expect(horas).toContain("10:30");
    }
  });

  it("servicio inexistente", async () => {
    const r = await consultarHorarios(
      repoEnMemoria().repo,
      tenant,
      { servicioId: "x", profesionalId: "carlos", fecha: LUNES },
      AHORA,
    );
    expect(r).toEqual({ ok: false, codigo: "servicio_invalido" });
  });
});

describe("crearReserva contra Postgres real (PGlite + restricción de exclusión)", () => {
  let cliente: PGlite;
  let db: ReturnType<typeof drizzle>;
  let repo: RepoReservas;

  beforeAll(async () => {
    cliente = new PGlite({ extensions: { btree_gist } });
    db = drizzle(cliente);
    await migrate(db, { migrationsFolder: "./drizzle" });
    repo = crearRepositorio(db as never);
  });
  afterAll(async () => {
    await cliente.close();
  });
  beforeEach(async () => {
    await db.delete(bookings);
  });

  it("guarda la reserva con todos sus campos", async () => {
    const r = await crearReserva(repo, tenant, entrada({ correo: "maria@correo.com" }), contexto());
    expect(r.ok).toBe(true);
    const [fila] = await db.select().from(bookings);
    expect(fila).toMatchObject({
      tenantSlug: "prueba",
      serviceId: "corte",
      professionalId: "carlos",
      customerName: "María Pérez",
      customerPhone: "3001234567",
      customerEmail: "maria@correo.com",
      status: "confirmada",
      source: "web",
      customerIpHash: "ip-1",
    });
    expect(fila.startsAt.toISOString()).toBe("2030-03-04T15:00:00.000Z");
    expect(fila.manageToken).toMatch(/^token-/);
  });

  it("con 'cualquiera' reparte entre los 3 profesionales y la 4.ª persona no encuentra cupo", async () => {
    const asignados: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await crearReserva(
        repo,
        tenant,
        entrada({ profesionalId: "cualquiera", celular: `300000000${i}` }),
        contexto({ ipHash: null }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) asignados.push(r.reserva.profesionalId);
    }
    expect(new Set(asignados)).toEqual(new Set(["carlos", "andres", "mateo"]));
    const cuarta = await crearReserva(
      repo,
      tenant,
      entrada({ profesionalId: "cualquiera", celular: "3000000009" }),
      contexto({ ipHash: null }),
    );
    expect(cuarta).toEqual({ ok: false, codigo: "horario_ocupado" });
  });

  it("dos reservas simultáneas del mismo horario: solo una gana, la otra recibe un mensaje y no un error", async () => {
    const [a, b] = await Promise.all([
      crearReserva(repo, tenant, entrada({ celular: "3001111111" }), contexto({ ipHash: null })),
      crearReserva(repo, tenant, entrada({ celular: "3002222222" }), contexto({ ipHash: null })),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const perdedora = a.ok ? b : a;
    expect(perdedora).toEqual({ ok: false, codigo: "horario_ocupado" });
    expect(await db.select().from(bookings)).toHaveLength(1);
  });

  it("los contadores del repositorio ignoran canceladas y pasadas", async () => {
    await crearReserva(repo, tenant, entrada({ hora: "09:00" }), contexto());
    await crearReserva(repo, tenant, entrada({ hora: "10:00" }), contexto());
    const filas = await db.select().from(bookings);
    await db.update(bookings).set({ status: "cancelada" }).where(eq(bookings.id, filas[0].id));

    expect(await repo.contarActivasFuturas("prueba", "3001234567", AHORA)).toBe(1);
    expect(
      await repo.contarActivasFuturas("prueba", "3001234567", bogota("2030-03-05", "00:00")),
    ).toBe(0);
    expect(await repo.contarActivasFuturas("otro-negocio", "3001234567", AHORA)).toBe(0);
    expect(await repo.contarPorIpDesde("ip-1", new Date(0))).toBe(2);
    expect(await repo.contarPorIpDesde("ip-1", new Date(Date.now() + 86_400_000))).toBe(0);
  });
});
