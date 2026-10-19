import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { esTraslape } from "../src/db/errores";
import { getDb } from "../src/db";
import { bookings } from "../src/db/schema";

config({ path: ".env.local" });

/**
 * Comprueba contra la base real (DATABASE_URL) que las migraciones están aplicadas y que la
 * restricción anti-traslape funciona. Usa un negocio ficticio y borra lo que crea.
 */
const TENANT = "__verificacion__";
const db = getDb();

function fila(inicio: string, fin: string, token: string) {
  return {
    tenantSlug: TENANT,
    serviceId: "corte",
    professionalId: "carlos",
    startsAt: new Date(inicio),
    endsAt: new Date(fin),
    customerName: "Verificación",
    customerPhone: "3000000000",
    manageToken: token,
  };
}

let fallos = 0;
function comprobar(descripcion: string, ok: boolean) {
  console.log(`${ok ? "OK   " : "FALLA"} ${descripcion}`);
  if (!ok) fallos++;
}

async function main() {
  try {
    const restriccion = await db.execute(
      sql`select conname from pg_constraint where conname = 'bookings_sin_traslape'`,
    );
    comprobar("existe la restricción bookings_sin_traslape", restriccion.rows.length === 1);

    await db.insert(bookings).values(fila("2030-03-04T15:00:00Z", "2030-03-04T15:30:00Z", "v-1"));
    comprobar("inserta una reserva", true);

    const traslape = await db
      .insert(bookings)
      .values(fila("2030-03-04T15:15:00Z", "2030-03-04T15:45:00Z", "v-2"))
      .then(
        () => null,
        (e: unknown) => e,
      );
    comprobar("rechaza una reserva traslapada (esTraslape)", esTraslape(traslape));

    await db.insert(bookings).values(fila("2030-03-04T15:30:00Z", "2030-03-04T16:00:00Z", "v-3"));
    comprobar("acepta una reserva contigua", true);
  } catch (error) {
    console.error(error);
    fallos++;
  } finally {
    await db.delete(bookings).where(eq(bookings.tenantSlug, TENANT));
    console.log("Datos de verificación borrados.");
  }
}

main().then(() => process.exit(fallos > 0 ? 1 : 0));
