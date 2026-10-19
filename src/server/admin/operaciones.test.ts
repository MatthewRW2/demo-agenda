import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { blocks, bookings, type NuevaBooking } from "@/db/schema";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import { crearRepositorio } from "@/server/reservas/repositorio";
import { consultarHorarios } from "@/server/reservas/servicio";
import {
  borrarBloqueo,
  bloqueosEnRango,
  cambiarEstado,
  citasConfirmadasDelDia,
  crearBloqueo,
  crearCitaAdmin,
  horariosParaAdmin,
  marcarRecordatorio,
  reservasEnRango,
} from "./operaciones";

const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const LUNES = "2030-03-04";
const tenant = tenantDePrueba; // slug "prueba"
const OTRO = "otro-negocio";

describe("operaciones del panel (Postgres real)", () => {
  let cliente: PGlite;
  let db: ReturnType<typeof drizzle>;
  // El tipo de Neon y el de PGlite no coinciden del todo; en producción sí es Neon.
  const base = () => db as never;

  beforeAll(async () => {
    cliente = new PGlite({ extensions: { btree_gist } });
    db = drizzle(cliente);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });
  afterAll(async () => {
    await cliente.close();
  });
  beforeEach(async () => {
    await db.delete(bookings);
    await db.delete(blocks);
  });

  async function insertar(extra: Partial<NuevaBooking> & { desde: string; hasta: string }) {
    const { desde, hasta, ...resto } = extra;
    const [fila] = await db
      .insert(bookings)
      .values({
        tenantSlug: tenant.slug,
        serviceId: "corte",
        professionalId: "carlos",
        startsAt: bogota(LUNES, desde),
        endsAt: bogota(LUNES, hasta),
        customerName: "María Pérez",
        customerPhone: "3001234567",
        manageToken: randomBytes(32).toString("base64url"),
        ...resto,
      })
      .returning();
    return fila;
  }

  const estado = async (id: string) =>
    (await db.select().from(bookings).where(eq(bookings.id, id)))[0].status;

  describe("consultas por rango", () => {
    it("devuelve reservas de todos los estados que tocan el rango, ordenadas, solo de ese negocio", async () => {
      await insertar({ desde: "11:00", hasta: "11:30", status: "completada" });
      await insertar({ desde: "09:00", hasta: "09:30", status: "cancelada" });
      await insertar({ desde: "10:00", hasta: "10:30", tenantSlug: OTRO });
      await insertar({ desde: "10:00", hasta: "10:30" });
      const { desde, hasta } = {
        desde: bogota(LUNES, "00:00"),
        hasta: bogota("2030-03-05", "00:00"),
      };
      const r = await reservasEnRango(base(), tenant.slug, desde, hasta);
      expect(r.map((x) => x.startsAt.toISOString())).toEqual([
        "2030-03-04T14:00:00.000Z",
        "2030-03-04T15:00:00.000Z",
        "2030-03-04T16:00:00.000Z",
      ]);
      expect(r.every((x) => x.tenantSlug === tenant.slug)).toBe(true);
    });

    it("no incluye lo que termina justo cuando empieza el rango ni lo que empieza al terminar", async () => {
      await insertar({ desde: "09:00", hasta: "09:30" });
      const r = await reservasEnRango(
        base(),
        tenant.slug,
        bogota(LUNES, "09:30"),
        bogota(LUNES, "10:00"),
      );
      expect(r).toHaveLength(0);
    });
  });

  describe("cambiarEstado", () => {
    it("cambia el estado de una cita del negocio", async () => {
      const c = await insertar({ desde: "10:00", hasta: "10:30" });
      expect(await cambiarEstado(base(), tenant.slug, c.id, "no_asistio")).toBe("ok");
      expect(await estado(c.id)).toBe("no_asistio");
    });

    it("aislamiento: no toca una cita de otro negocio aunque se conozca su id", async () => {
      const ajena = await insertar({ desde: "10:00", hasta: "10:30", tenantSlug: OTRO });
      expect(await cambiarEstado(base(), tenant.slug, ajena.id, "cancelada")).toBe("no_encontrada");
      expect(await estado(ajena.id)).toBe("confirmada");
    });

    it("ids inválidos o estados inventados no llegan a la base", async () => {
      const c = await insertar({ desde: "10:00", hasta: "10:30" });
      expect(await cambiarEstado(base(), tenant.slug, "no-es-un-uuid", "cancelada")).toBe(
        "no_encontrada",
      );
      expect(await cambiarEstado(base(), tenant.slug, c.id, "borrada" as never)).toBe(
        "no_encontrada",
      );
      expect(await estado(c.id)).toBe("confirmada");
    });

    it("reactivar una cita cancelada cuyo horario ya se ocupó avisa en vez de fallar", async () => {
      const cancelada = await insertar({ desde: "10:00", hasta: "10:30", status: "cancelada" });
      await insertar({ desde: "10:00", hasta: "10:30" });
      expect(await cambiarEstado(base(), tenant.slug, cancelada.id, "confirmada")).toBe(
        "horario_ocupado",
      );
      expect(await estado(cancelada.id)).toBe("cancelada");
    });

    it("una cita inexistente no se encuentra", async () => {
      expect(
        await cambiarEstado(
          base(),
          tenant.slug,
          "00000000-0000-4000-8000-000000000000",
          "completada",
        ),
      ).toBe("no_encontrada");
    });
  });

  describe("recordatorios", () => {
    it("marca el recordatorio como enviado solo en citas confirmadas del negocio", async () => {
      const c = await insertar({ desde: "10:00", hasta: "10:30" });
      const ahora = new Date("2030-03-03T15:00:00Z");
      expect(await marcarRecordatorio(base(), tenant.slug, c.id, ahora)).toBe(true);
      const [f] = await db.select().from(bookings).where(eq(bookings.id, c.id));
      expect(f.reminderSentAt?.toISOString()).toBe(ahora.toISOString());

      const ajena = await insertar({ desde: "11:00", hasta: "11:30", tenantSlug: OTRO });
      expect(await marcarRecordatorio(base(), tenant.slug, ajena.id, ahora)).toBe(false);
      const cancelada = await insertar({ desde: "12:00", hasta: "12:30", status: "cancelada" });
      expect(await marcarRecordatorio(base(), tenant.slug, cancelada.id, ahora)).toBe(false);
    });

    it("citasConfirmadasDelDia: solo confirmadas que empiezan ese día de Bogotá, incluidos los bordes", async () => {
      await insertar({ desde: "00:00", hasta: "00:30" }); // borde inicial: entra
      await insertar({ desde: "19:30", hasta: "20:00", professionalId: "andres" }); // 00:30Z del día siguiente: entra
      await insertar({
        desde: "10:00",
        hasta: "10:30",
        professionalId: "mateo",
        status: "cancelada",
      });
      await insertar({
        desde: "11:00",
        hasta: "11:30",
        professionalId: "mateo",
        status: "completada",
      });
      await insertar({ desde: "10:00", hasta: "10:30", tenantSlug: OTRO });
      const manana = bogota("2030-03-05", "00:00");
      await db.insert(bookings).values({
        tenantSlug: tenant.slug,
        serviceId: "corte",
        professionalId: "carlos",
        startsAt: manana, // empieza el día siguiente: no entra
        endsAt: new Date(manana.getTime() + 1_800_000),
        customerName: "Mañana",
        customerPhone: "3000000000",
        manageToken: randomBytes(32).toString("base64url"),
      });
      const r = await citasConfirmadasDelDia(base(), tenant.slug, LUNES);
      expect(r.map((x) => x.customerName)).toEqual(["María Pérez", "María Pérez"]);
      expect(r.map((x) => x.startsAt.toISOString())).toEqual([
        "2030-03-04T05:00:00.000Z",
        "2030-03-05T00:30:00.000Z",
      ]);
    });
  });

  describe("crearCitaAdmin", () => {
    const entrada = (extra = {}) => ({
      servicioId: "corte",
      profesionalId: "carlos",
      fecha: LUNES,
      hora: "10:00",
      nombre: "Cliente sin reserva",
      ...extra,
    });

    it("crea la cita con origen 'admin', notas y sin celular", async () => {
      const r = await crearCitaAdmin(base(), tenant, entrada({ notas: "  Llegó sin cita  " }));
      expect(r.ok).toBe(true);
      const [f] = await db.select().from(bookings);
      expect(f).toMatchObject({
        source: "admin",
        status: "confirmada",
        customerName: "Cliente sin reserva",
        customerPhone: "",
        customerEmail: null,
        notes: "Llegó sin cita",
        professionalId: "carlos",
      });
      expect(f.startsAt.toISOString()).toBe("2030-03-04T15:00:00.000Z");
      expect(f.manageToken).toHaveLength(43);
    });

    it("normaliza el celular si lo dan, y lo rechaza si está mal", async () => {
      await crearCitaAdmin(base(), tenant, entrada({ celular: "+57 300 123 4567" }));
      expect((await db.select().from(bookings))[0].customerPhone).toBe("3001234567");
      const mal = await crearCitaAdmin(
        base(),
        tenant,
        entrada({ hora: "12:00", celular: "12345" }),
      );
      expect(mal).toMatchObject({ ok: false, codigo: "invalida" });
      if (!mal.ok) expect(mal.errores?.celular).toMatch(/celular colombiano/);
    });

    it("no aplica la anticipación mínima ni la ventana de días: se puede registrar en el pasado", async () => {
      // 6 de enero de 2020 fue lunes: un día pasado lejano que el público jamás vería
      const r = await crearCitaAdmin(
        base(),
        tenant,
        entrada({ fecha: "2020-01-06", hora: "09:00" }),
      );
      expect(r.ok).toBe(true);
    });

    it("el panel ignora una anticipación mínima grande del negocio (el público sí la respeta)", async () => {
      const estricto = { ...tenant, anticipacionMinHoras: 24 };
      const r = await crearCitaAdmin(
        base(),
        estricto,
        entrada({ fecha: "2020-01-06", hora: "09:00" }),
      );
      expect(r.ok).toBe(true);
      // ...mientras que el flujo público, con el mismo negocio, no ofrece ese horario
      const publico = await consultarHorarios(
        crearRepositorio(base()),
        estricto,
        { servicioId: "corte", profesionalId: "carlos", fecha: "2030-03-04" },
        new Date("2030-03-04T14:00:00Z"), // 09:00 en Bogotá del mismo día
      );
      expect(publico.ok && publico.horarios).toEqual([]);
    });

    it("sigue respetando el horario del local, la rejilla y los traslapes", async () => {
      await crearCitaAdmin(base(), tenant, entrada());
      expect(await crearCitaAdmin(base(), tenant, entrada({ nombre: "Otro" }))).toEqual({
        ok: false,
        codigo: "horario_ocupado",
      });
      for (const hora of ["07:00", "10:07", "19:00"]) {
        expect(await crearCitaAdmin(base(), tenant, entrada({ hora })), hora).toEqual({
          ok: false,
          codigo: "horario_ocupado",
        });
      }
      expect(await crearCitaAdmin(base(), tenant, entrada({ fecha: "2030-03-03" }))).toEqual({
        ok: false,
        codigo: "horario_ocupado",
      }); // domingo
    });

    it("respeta los bloqueos", async () => {
      await crearBloqueo(base(), tenant, {
        profesionalId: "todos",
        fecha: LUNES,
        desde: "12:00",
        hasta: "14:00",
      });
      expect(await crearCitaAdmin(base(), tenant, entrada({ hora: "12:30" }))).toEqual({
        ok: false,
        codigo: "horario_ocupado",
      });
    });

    it("valida los campos con mensajes en español", async () => {
      const r = await crearCitaAdmin(base(), tenant, entrada({ nombre: "A" }));
      expect(r).toMatchObject({ ok: false, codigo: "invalida" });
      if (!r.ok) expect(r.errores?.nombre).toBe("Escribe el nombre del cliente.");
      expect(await crearCitaAdmin(base(), tenant, entrada({ servicioId: "tinte" }))).toMatchObject({
        ok: false,
        codigo: "invalida",
      });
      expect(await crearCitaAdmin(base(), tenant, entrada({ profesionalId: "zoe" }))).toMatchObject(
        {
          ok: false,
          codigo: "invalida",
        },
      );
    });

    it("con 'cualquiera' asigna un profesional libre", async () => {
      await insertar({ desde: "10:00", hasta: "10:30" }); // Carlos ocupado
      const r = await crearCitaAdmin(base(), tenant, entrada({ profesionalId: "cualquiera" }));
      expect(r.ok).toBe(true);
      const filas = await db.select().from(bookings);
      expect(filas).toHaveLength(2);
      expect(new Set(filas.map((f) => f.professionalId)).size).toBe(2);
    });

    it("horariosParaAdmin ofrece horas que el público ya no vería", async () => {
      const admin = await horariosParaAdmin(base(), tenant, {
        servicioId: "corte",
        profesionalId: "carlos",
        fecha: "2020-01-06",
      });
      expect(admin?.length).toBeGreaterThan(0);
      const publico = await consultarHorarios(
        crearRepositorio(base()),
        tenant,
        { servicioId: "corte", profesionalId: "carlos", fecha: "2020-01-06" },
        new Date("2030-03-01T15:00:00Z"),
      );
      expect(publico.ok && publico.horarios).toEqual([]);
    });
  });

  describe("bloqueos", () => {
    const entrada = (extra = {}) => ({
      profesionalId: "todos",
      fecha: LUNES,
      desde: "12:00",
      hasta: "14:00",
      motivo: "Almuerzo",
      ...extra,
    });

    it("bloquea todo el local (profesional nulo) y quita esos horarios al público", async () => {
      const r = await crearBloqueo(base(), tenant, entrada());
      expect(r).toMatchObject({ ok: true, citasAfectadas: 0 });
      const [b] = await db.select().from(blocks);
      expect(b).toMatchObject({
        professionalId: null,
        reason: "Almuerzo",
        tenantSlug: tenant.slug,
      });
      expect(b.startsAt.toISOString()).toBe("2030-03-04T17:00:00.000Z");

      const publico = await consultarHorarios(
        crearRepositorio(base()),
        tenant,
        { servicioId: "corte", profesionalId: "cualquiera", fecha: LUNES },
        new Date("2030-03-01T15:00:00Z"),
      );
      const horas = publico.ok ? publico.horarios.map((h) => h.hora) : [];
      expect(horas).toContain("11:30");
      expect(horas).not.toContain("12:00");
      expect(horas).not.toContain("13:45");
      expect(horas).toContain("14:00");
    });

    it("un bloqueo de un profesional solo le afecta a él", async () => {
      await crearBloqueo(base(), tenant, entrada({ profesionalId: "carlos" }));
      const publico = await consultarHorarios(
        crearRepositorio(base()),
        tenant,
        { servicioId: "corte", profesionalId: "andres", fecha: LUNES },
        new Date("2030-03-01T15:00:00Z"),
      );
      expect(publico.ok && publico.horarios.map((h) => h.hora)).toContain("12:00");
    });

    it("avisa cuántas citas confirmadas quedan dentro del bloqueo (y no las cancela)", async () => {
      const c = await insertar({ desde: "12:30", hasta: "13:00" });
      await insertar({ desde: "13:00", hasta: "13:30", professionalId: "andres" });
      await insertar({
        desde: "13:30",
        hasta: "14:00",
        professionalId: "mateo",
        status: "cancelada",
      });
      await insertar({ desde: "12:30", hasta: "13:00", tenantSlug: OTRO });
      const todos = await crearBloqueo(base(), tenant, entrada());
      expect(todos).toMatchObject({ ok: true, citasAfectadas: 2 });
      const soloCarlos = await crearBloqueo(base(), tenant, entrada({ profesionalId: "carlos" }));
      expect(soloCarlos).toMatchObject({ ok: true, citasAfectadas: 1 });
      expect(await estado(c.id)).toBe("confirmada");
    });

    it("valida las horas y el profesional", async () => {
      const r1 = await crearBloqueo(base(), tenant, entrada({ desde: "14:00", hasta: "12:00" }));
      expect(r1).toMatchObject({ ok: false });
      if (!r1.ok) expect(r1.errores.hasta).toMatch(/posterior/);
      expect(
        await crearBloqueo(base(), tenant, entrada({ desde: "12:00", hasta: "12:00" })),
      ).toMatchObject({ ok: false });
      expect(await crearBloqueo(base(), tenant, entrada({ desde: "abc" }))).toMatchObject({
        ok: false,
      });
      expect(await crearBloqueo(base(), tenant, entrada({ profesionalId: "zoe" }))).toMatchObject({
        ok: false,
        errores: { profesionalId: "Profesional inexistente." },
      });
      expect(await db.select().from(blocks)).toHaveLength(0);
    });

    it("se puede borrar, pero solo desde su propio negocio", async () => {
      const r = await crearBloqueo(base(), tenant, entrada());
      if (!r.ok) throw new Error("no se creó");
      expect(await borrarBloqueo(base(), OTRO, r.id)).toBe(false);
      expect(await db.select().from(blocks)).toHaveLength(1);
      expect(await borrarBloqueo(base(), tenant.slug, r.id)).toBe(true);
      expect(await db.select().from(blocks)).toHaveLength(0);
      expect(await borrarBloqueo(base(), tenant.slug, "no-es-uuid")).toBe(false);
    });

    it("bloqueosEnRango filtra por negocio y rango", async () => {
      await crearBloqueo(base(), tenant, entrada());
      await db.insert(blocks).values({
        tenantSlug: OTRO,
        professionalId: null,
        startsAt: bogota(LUNES, "12:00"),
        endsAt: bogota(LUNES, "13:00"),
      });
      const r = await bloqueosEnRango(
        base(),
        tenant.slug,
        bogota(LUNES, "00:00"),
        bogota("2030-03-05", "00:00"),
      );
      expect(r).toHaveLength(1);
      expect(r[0].tenantSlug).toBe(tenant.slug);
    });
  });
});
