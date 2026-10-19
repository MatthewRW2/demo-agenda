import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookings } from "@/db/schema";
import type { EntradaReserva } from "@/lib/validacion";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import {
  cancelarReserva,
  evaluarGestion,
  horariosParaReprogramar,
  reprogramarReserva,
  type RepoGestion,
} from "./gestion";
import { crearRepositorio } from "./repositorio";
import { crearReserva } from "./servicio";

const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const AHORA = bogota("2030-03-01", "10:00"); // viernes; anticipación mínima = 2 h
const LUNES = "2030-03-04";
const tenant = { ...tenantDePrueba, demo: true };

describe("evaluarGestion", () => {
  const base = { startsAt: bogota(LUNES, "10:00"), status: "confirmada" as const };

  it("permite gestionar una cita confirmada con tiempo de sobra", () => {
    expect(evaluarGestion(tenant, base, AHORA)).toEqual({ ok: true });
  });

  it("exige la anticipación mínima: justo 2 h sí, un minuto menos no", () => {
    expect(evaluarGestion(tenant, base, bogota(LUNES, "08:00"))).toEqual({ ok: true });
    expect(evaluarGestion(tenant, base, bogota(LUNES, "08:01"))).toEqual({
      ok: false,
      motivo: "muy_cerca",
    });
  });

  it("una cita que ya empezó o pasó es 'pasada'", () => {
    expect(evaluarGestion(tenant, base, bogota(LUNES, "10:00"))).toEqual({
      ok: false,
      motivo: "pasada",
    });
    expect(evaluarGestion(tenant, base, bogota(LUNES, "15:00"))).toEqual({
      ok: false,
      motivo: "pasada",
    });
  });

  it.each(["cancelada", "completada", "no_asistio"] as const)(
    "una cita %s no es gestionable",
    (status) => {
      expect(evaluarGestion(tenant, { ...base, status }, AHORA)).toEqual({
        ok: false,
        motivo: "no_activa",
      });
    },
  );

  it("usa la anticipación del negocio", () => {
    const sinAnticipacion = { ...tenant, anticipacionMinHoras: 0 };
    expect(evaluarGestion(sinAnticipacion, base, bogota(LUNES, "09:59"))).toEqual({ ok: true });
  });
});

describe("cancelar y reprogramar (Postgres real)", () => {
  let cliente: PGlite;
  let db: ReturnType<typeof drizzle>;
  let repo: RepoGestion;
  let telefono = 0;

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

  /** Crea una reserva con el flujo real y devuelve su token. */
  async function reservar(hora: string, extra: Partial<EntradaReserva> = {}) {
    const r = await crearReserva(
      repo,
      tenant,
      {
        servicioId: "corte",
        profesionalId: "carlos",
        fecha: LUNES,
        hora,
        nombre: "María Pérez",
        celular: `300${String(1000000 + ++telefono)}`,
        ...extra,
      },
      { ahora: AHORA, ipHash: null, generarToken: () => randomBytes(32).toString("base64url") },
    );
    if (!r.ok) throw new Error(`no se pudo crear la reserva de prueba: ${r.codigo}`);
    return r.reserva;
  }

  const fila = async (id: string) =>
    (await db.select().from(bookings).where(eq(bookings.id, id)))[0];

  describe("cancelarReserva", () => {
    it("cancela, y el horario vuelve a quedar libre para otra persona", async () => {
      const { id, manageToken } = await reservar("10:00");
      expect(await cancelarReserva(repo, tenant, manageToken, AHORA)).toEqual({ ok: true });
      expect((await fila(id)).status).toBe("cancelada");
      await expect(reservar("10:00")).resolves.toBeDefined();
    });

    it("cancelar dos veces: la segunda avisa que ya no está activa", async () => {
      const { manageToken } = await reservar("10:00");
      await cancelarReserva(repo, tenant, manageToken, AHORA);
      expect(await cancelarReserva(repo, tenant, manageToken, AHORA)).toEqual({
        ok: false,
        codigo: "no_activa",
      });
    });

    it("token inexistente, mal formado o de otro negocio: no se encuentra", async () => {
      const { manageToken } = await reservar("10:00");
      const otro = { ...tenant, slug: "otro-negocio" };
      expect(await cancelarReserva(repo, tenant, "x".repeat(43), AHORA)).toEqual({
        ok: false,
        codigo: "no_encontrada",
      });
      expect(await cancelarReserva(repo, tenant, "corto", AHORA)).toEqual({
        ok: false,
        codigo: "no_encontrada",
      });
      expect(await cancelarReserva(repo, otro, manageToken, AHORA)).toEqual({
        ok: false,
        codigo: "no_encontrada",
      });
    });

    it("dentro de la anticipación mínima no se puede, y la cita sigue confirmada", async () => {
      const { id, manageToken } = await reservar("10:00");
      const casiHora = bogota(LUNES, "08:30");
      expect(await cancelarReserva(repo, tenant, manageToken, casiHora)).toEqual({
        ok: false,
        codigo: "muy_cerca",
      });
      expect((await fila(id)).status).toBe("confirmada");
    });
  });

  describe("operaciones atómicas del repositorio (dos pestañas a la vez)", () => {
    it("cancelar devuelve true una sola vez, aunque se llame dos veces seguidas", async () => {
      const { id } = await reservar("10:00");
      const [a, b] = await Promise.all([repo.cancelar(id), repo.cancelar(id)]);
      expect([a, b].filter(Boolean)).toHaveLength(1);
      expect((await fila(id)).status).toBe("cancelada");
    });

    it("no cancela ni mueve una cita que ya no está confirmada", async () => {
      const { id } = await reservar("10:00");
      await db.update(bookings).set({ status: "completada" }).where(eq(bookings.id, id));
      expect(await repo.cancelar(id)).toBe(false);
      expect(await repo.reprogramar(id, bogota(LUNES, "16:00"), bogota(LUNES, "16:30"))).toBe(
        false,
      );
      const f = await fila(id);
      expect(f.status).toBe("completada");
      expect(f.startsAt.toISOString()).toBe("2030-03-04T15:00:00.000Z");
    });

    it("no se puede reactivar moviendo una cita cancelada", async () => {
      const { id } = await reservar("10:00");
      await repo.cancelar(id);
      expect(await repo.reprogramar(id, bogota(LUNES, "16:00"), bogota(LUNES, "16:30"))).toBe(
        false,
      );
      expect((await fila(id)).status).toBe("cancelada");
    });
  });

  describe("horariosParaReprogramar", () => {
    it("ofrece su propio hueco y los que solo chocan con ella misma, pero no los de otras personas", async () => {
      const { manageToken } = await reservar("10:00"); // 10:00-10:30
      await reservar("11:00"); // otra persona 11:00-11:30
      const r = await horariosParaReprogramar(repo, tenant, manageToken, LUNES, AHORA);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const horas = r.horarios.map((h) => h.hora);
      expect(horas).toContain("10:00");
      expect(horas).toContain("09:45"); // 09:45-10:15 solo choca con su cita actual
      expect(horas).toContain("10:15");
      expect(horas).not.toContain("11:00");
      expect(horas).not.toContain("10:45"); // 10:45-11:15 choca con la de las 11:00
    });

    it("no ofrece horas dentro de la anticipación mínima", async () => {
      const { manageToken } = await reservar("10:00");
      const r = await horariosParaReprogramar(repo, tenant, manageToken, "2030-03-01", AHORA);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.horarios[0].hora).toBe("12:00"); // 10:00 + 2 h
    });

    it("no consulta si la cita no es gestionable", async () => {
      const { manageToken } = await reservar("10:00");
      await cancelarReserva(repo, tenant, manageToken, AHORA);
      expect(await horariosParaReprogramar(repo, tenant, manageToken, LUNES, AHORA)).toEqual({
        ok: false,
        codigo: "no_activa",
      });
    });
  });

  describe("reprogramarReserva", () => {
    it("mueve la cita, conserva servicio y profesional y borra el recordatorio enviado", async () => {
      const { id, manageToken } = await reservar("10:00");
      await db.update(bookings).set({ reminderSentAt: AHORA }).where(eq(bookings.id, id));

      const r = await reprogramarReserva(repo, tenant, manageToken, "2030-03-05", "15:30", AHORA);
      expect(r.ok).toBe(true);
      const f = await fila(id);
      expect(f.startsAt.toISOString()).toBe("2030-03-05T20:30:00.000Z"); // 15:30 en Bogotá
      expect(f.endsAt.toISOString()).toBe("2030-03-05T21:00:00.000Z");
      expect(f).toMatchObject({
        serviceId: "corte",
        professionalId: "carlos",
        status: "confirmada",
      });
      expect(f.reminderSentAt).toBeNull();
      // y el hueco anterior quedó libre
      await expect(reservar("10:00")).resolves.toBeDefined();
    });

    it("puede moverse a un horario que solo se traslapa con su propio hueco", async () => {
      const { id, manageToken } = await reservar("10:00");
      expect((await reprogramarReserva(repo, tenant, manageToken, LUNES, "10:15", AHORA)).ok).toBe(
        true,
      );
      expect((await fila(id)).startsAt.toISOString()).toBe("2030-03-04T15:15:00.000Z");
    });

    it("a un horario ocupado por otra persona: se rechaza y la cita no cambia", async () => {
      const { id, manageToken } = await reservar("10:00");
      await reservar("14:00");
      expect(await reprogramarReserva(repo, tenant, manageToken, LUNES, "14:00", AHORA)).toEqual({
        ok: false,
        codigo: "horario_ocupado",
      });
      expect((await fila(id)).startsAt.toISOString()).toBe("2030-03-04T15:00:00.000Z");
    });

    it("al mismo horario: sin cambios", async () => {
      const { manageToken } = await reservar("10:00");
      expect(await reprogramarReserva(repo, tenant, manageToken, LUNES, "10:00", AHORA)).toEqual({
        ok: false,
        codigo: "sin_cambios",
      });
    });

    it.each([
      ["hora fuera de la rejilla", LUNES, "10:07"],
      ["fuera del horario del negocio", LUNES, "22:00"],
      ["domingo (cerrado)", "2030-03-03", "10:00"],
      ["dentro de la anticipación mínima", "2030-03-01", "11:00"],
      ["fuera de los días reservables", "2030-06-03", "10:00"],
    ])("rechaza %s", async (_caso, fecha, hora) => {
      const { manageToken } = await reservar("10:00");
      expect(await reprogramarReserva(repo, tenant, manageToken, fecha, hora, AHORA)).toEqual({
        ok: false,
        codigo: "horario_ocupado",
      });
    });

    it("si alguien se adelanta justo antes de mover, responde horario_ocupado sin lanzar error", async () => {
      const { id, manageToken } = await reservar("10:00");
      const conCarrera: RepoGestion = {
        ...repo,
        async reprogramar(idReserva, inicio, fin) {
          // otra persona toma ese hueco entre el cálculo y el UPDATE
          await db.insert(bookings).values({
            tenantSlug: tenant.slug,
            serviceId: "corte",
            professionalId: "carlos",
            startsAt: inicio,
            endsAt: fin,
            customerName: "Otra persona",
            customerPhone: "3110000000",
            manageToken: randomBytes(32).toString("base64url"),
          });
          return repo.reprogramar(idReserva, inicio, fin);
        },
      };
      expect(
        await reprogramarReserva(conCarrera, tenant, manageToken, LUNES, "16:00", AHORA),
      ).toEqual({
        ok: false,
        codigo: "horario_ocupado",
      });
      expect((await fila(id)).startsAt.toISOString()).toBe("2030-03-04T15:00:00.000Z");
    });

    it("una cita cancelada no se puede mover", async () => {
      const { manageToken } = await reservar("10:00");
      await cancelarReserva(repo, tenant, manageToken, AHORA);
      expect(await reprogramarReserva(repo, tenant, manageToken, LUNES, "16:00", AHORA)).toEqual({
        ok: false,
        codigo: "no_activa",
      });
    });

    it("dentro de la anticipación mínima de la cita actual no se puede mover", async () => {
      const { id, manageToken } = await reservar("10:00");
      expect(
        await reprogramarReserva(repo, tenant, manageToken, LUNES, "16:00", bogota(LUNES, "08:30")),
      ).toEqual({ ok: false, codigo: "muy_cerca" });
      expect((await fila(id)).startsAt.toISOString()).toBe("2030-03-04T15:00:00.000Z");
    });
  });
});
