import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ESTADOS_RESERVA = ["confirmada", "completada", "no_asistio", "cancelada"] as const;
export const ORIGENES_RESERVA = ["web", "admin"] as const;

export const estadoReserva = pgEnum("estado_reserva", ESTADOS_RESERVA);
export const origenReserva = pgEnum("origen_reserva", ORIGENES_RESERVA);

/**
 * Todas las fechas son timestamptz: se guardan en UTC y se muestran en America/Bogota.
 *
 * La restricción de exclusión que impide dos reservas activas traslapadas para el mismo
 * profesional NO se puede declarar en Drizzle; vive en la migración
 * `drizzle/*_exclusion_traslapes.sql` (constraint `bookings_sin_traslape`).
 */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug: text("tenant_slug").notNull(),
    serviceId: text("service_id").notNull(),
    professionalId: text("professional_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    status: estadoReserva("status").notNull().default("confirmada"),
    manageToken: text("manage_token").notNull().unique(),
    source: origenReserva("source").notNull().default("web"),
    notes: text("notes"),
    /** Se llena cuando el negocio envía el recordatorio por WhatsApp (Fase 7). */
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("bookings_rango_valido", sql`${t.endsAt} > ${t.startsAt}`),
    index("bookings_tenant_inicio_idx").on(t.tenantSlug, t.startsAt),
    index("bookings_tenant_telefono_idx").on(t.tenantSlug, t.customerPhone),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug: text("tenant_slug").notNull(),
    /** null = bloquea todo el local. */
    professionalId: text("professional_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("blocks_rango_valido", sql`${t.endsAt} > ${t.startsAt}`),
    index("blocks_tenant_inicio_idx").on(t.tenantSlug, t.startsAt),
  ],
);

export type Booking = typeof bookings.$inferSelect;
export type NuevaBooking = typeof bookings.$inferInsert;
export type Block = typeof blocks.$inferSelect;
export type NuevoBlock = typeof blocks.$inferInsert;
