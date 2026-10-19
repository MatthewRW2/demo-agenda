import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { esTraslape } from "./errores";
import { blocks, bookings, type NuevaBooking } from "./schema";

let cliente: PGlite;
let db: ReturnType<typeof drizzle>;
let contador = 0;

/** Hora de Bogotá (UTC-5, sin horario de verano) -> Date UTC. */
const bogota = (hora: string) => new Date(`2030-03-04T${hora}:00-05:00`);

function reserva(parcial: Partial<NuevaBooking> & Pick<NuevaBooking, "startsAt" | "endsAt">) {
  return {
    tenantSlug: "don-carlos",
    serviceId: "corte",
    professionalId: "carlos",
    customerName: "Cliente de prueba",
    customerPhone: "3001234567",
    manageToken: `token-${++contador}`,
    ...parcial,
  } satisfies NuevaBooking;
}

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

describe("restricción de exclusión bookings_sin_traslape", () => {
  const base = () => reserva({ startsAt: bogota("10:00"), endsAt: bogota("10:30") });

  it("rechaza una reserva que se traslapa con otra del mismo profesional", async () => {
    await db.insert(bookings).values(base());

    const traslapada = db
      .insert(bookings)
      .values(reserva({ startsAt: bogota("10:15"), endsAt: bogota("10:45") }));

    const error = await traslapada.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).not.toBeNull();
    expect(esTraslape(error)).toBe(true);
  });

  it("rechaza el mismo horario exacto y el que contiene al existente", async () => {
    await db.insert(bookings).values(base());

    for (const [inicio, fin] of [
      ["10:00", "10:30"],
      ["09:30", "11:00"],
      ["10:10", "10:20"],
    ]) {
      const error = await db
        .insert(bookings)
        .values(reserva({ startsAt: bogota(inicio), endsAt: bogota(fin) }))
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(esTraslape(error), `${inicio}-${fin}`).toBe(true);
    }
  });

  it("permite citas contiguas (una termina cuando empieza la otra)", async () => {
    await db.insert(bookings).values(base());
    await db
      .insert(bookings)
      .values(reserva({ startsAt: bogota("10:30"), endsAt: bogota("11:00") }));
    await db
      .insert(bookings)
      .values(reserva({ startsAt: bogota("09:30"), endsAt: bogota("10:00") }));
    expect(await db.select().from(bookings)).toHaveLength(3);
  });

  it("permite el mismo horario con otro profesional u otro negocio", async () => {
    await db.insert(bookings).values(base());
    await db
      .insert(bookings)
      .values({ ...base(), manageToken: "otro-1", professionalId: "andres" });
    await db
      .insert(bookings)
      .values({ ...base(), manageToken: "otro-2", tenantSlug: "otra-barberia" });
    expect(await db.select().from(bookings)).toHaveLength(3);
  });

  it("una reserva cancelada libera el horario", async () => {
    await db.insert(bookings).values({ ...base(), status: "cancelada" });
    await db.insert(bookings).values(base());
    expect(await db.select().from(bookings)).toHaveLength(2);
  });

  it("completada y no_asistio siguen ocupando el horario", async () => {
    for (const status of ["completada", "no_asistio"] as const) {
      await db.delete(bookings);
      await db.insert(bookings).values({ ...base(), status });
      const error = await db
        .insert(bookings)
        .values(base())
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(esTraslape(error), status).toBe(true);
    }
  });

  it("no deja reactivar una cancelada si su horario ya fue tomado", async () => {
    const [cancelada] = await db
      .insert(bookings)
      .values({ ...base(), status: "cancelada" })
      .returning();
    await db.insert(bookings).values(base());

    const error = await db
      .update(bookings)
      .set({ status: "confirmada" })
      .where(eq(bookings.id, cancelada.id))
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(esTraslape(error)).toBe(true);
  });

  it("con carreras: de dos inserciones simultáneas solo una gana", async () => {
    const resultados = await Promise.allSettled([
      db.insert(bookings).values(base()),
      db.insert(bookings).values(base()),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazada = resultados.find((r) => r.status === "rejected");
    expect(esTraslape(rechazada?.status === "rejected" ? rechazada.reason : null)).toBe(true);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });
});

describe("otras reglas de la tabla", () => {
  it("rechaza un rango donde el fin no es posterior al inicio", async () => {
    const error = await db
      .insert(bookings)
      .values(reserva({ startsAt: bogota("11:00"), endsAt: bogota("10:00") }))
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(error).not.toBeNull();
    expect(esTraslape(error)).toBe(false);
  });

  it("manage_token es único", async () => {
    await db
      .insert(bookings)
      .values(
        reserva({ startsAt: bogota("10:00"), endsAt: bogota("10:30"), manageToken: "igual" }),
      );
    const error = await db
      .insert(bookings)
      .values(reserva({ startsAt: bogota("12:00"), endsAt: bogota("12:30"), manageToken: "igual" }))
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(error).not.toBeNull();
    expect(esTraslape(error)).toBe(false);
  });

  it("guarda en UTC: 10:00 en Bogotá es 15:00Z", async () => {
    const [fila] = await db
      .insert(bookings)
      .values(reserva({ startsAt: bogota("10:00"), endsAt: bogota("10:30") }))
      .returning();
    expect(fila.startsAt.toISOString()).toBe("2030-03-04T15:00:00.000Z");
  });

  it("los bloqueos aceptan professional_id nulo (todo el local)", async () => {
    await db.insert(blocks).values({
      tenantSlug: "don-carlos",
      professionalId: null,
      startsAt: bogota("12:00"),
      endsAt: bogota("14:00"),
      reason: "Festivo",
    });
    expect((await db.select().from(blocks))[0].professionalId).toBeNull();
  });
});

describe("esTraslape", () => {
  it("recorre la cadena de causas y no confunde otros errores", () => {
    expect(esTraslape({ code: "23P01" })).toBe(true);
    expect(esTraslape(new Error("x", { cause: { code: "23P01" } }))).toBe(true);
    expect(esTraslape({ code: "23505" })).toBe(false);
    expect(esTraslape(null)).toBe(false);
    expect(esTraslape("texto")).toBe(false);
  });
});
