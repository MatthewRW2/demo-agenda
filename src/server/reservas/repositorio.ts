import { and, count, eq, gt, gte, lt, ne } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { blocks, bookings } from "@/db/schema";
import type * as schema from "@/db/schema";
import { buscarReservaPorToken } from "./consultas";
import type { RepoGestion } from "./gestion";

/** Cualquier base Drizzle de Postgres (Neon en producción, PGlite en las pruebas). */
export type BaseDatos = PgDatabase<PgQueryResultHKT, typeof schema>;

export function crearRepositorio(db: BaseDatos): RepoGestion {
  return {
    async reservasDelDia(slug, desde, hasta, excluirId) {
      const filas = await db
        .select({
          professionalId: bookings.professionalId,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
          status: bookings.status,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantSlug, slug),
            ne(bookings.status, "cancelada"),
            lt(bookings.startsAt, hasta),
            gt(bookings.endsAt, desde),
            excluirId ? ne(bookings.id, excluirId) : undefined,
          ),
        );
      return filas;
    },

    async bloqueosDelDia(slug, desde, hasta) {
      return db
        .select({
          professionalId: blocks.professionalId,
          startsAt: blocks.startsAt,
          endsAt: blocks.endsAt,
        })
        .from(blocks)
        .where(
          and(eq(blocks.tenantSlug, slug), lt(blocks.startsAt, hasta), gt(blocks.endsAt, desde)),
        );
    },

    async contarActivasFuturas(slug, celular, ahora) {
      const [fila] = await db
        .select({ n: count() })
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantSlug, slug),
            eq(bookings.customerPhone, celular),
            eq(bookings.status, "confirmada"),
            gt(bookings.startsAt, ahora),
          ),
        );
      return fila?.n ?? 0;
    },

    async contarPorIpDesde(ipHash, desde) {
      const [fila] = await db
        .select({ n: count() })
        .from(bookings)
        .where(and(eq(bookings.customerIpHash, ipHash), gte(bookings.createdAt, desde)));
      return fila?.n ?? 0;
    },

    async insertar(datos) {
      const [fila] = await db
        .insert(bookings)
        .values({ ...datos, source: "web" })
        .returning({ id: bookings.id });
      return fila;
    },

    buscarPorToken: (slug, token) => buscarReservaPorToken(db, slug, token),

    // La condición de estado va en el propio UPDATE: así dos pestañas no se pisan.
    async cancelar(id) {
      const filas = await db
        .update(bookings)
        .set({ status: "cancelada" })
        .where(and(eq(bookings.id, id), eq(bookings.status, "confirmada")))
        .returning({ id: bookings.id });
      return filas.length > 0;
    },

    async reprogramar(id, inicio, fin) {
      const filas = await db
        .update(bookings)
        .set({ startsAt: inicio, endsAt: fin, reminderSentAt: null })
        .where(and(eq(bookings.id, id), eq(bookings.status, "confirmada")))
        .returning({ id: bookings.id });
      return filas.length > 0;
    },
  };
}
