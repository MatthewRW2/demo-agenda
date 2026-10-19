import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { esTraslape } from "@/db/errores";
import { blocks, bookings, ESTADOS_RESERVA, type Block, type Booking } from "@/db/schema";
import { instanteBogota, limitesDelDia } from "@/lib/disponibilidad";
import type { Tenant } from "@/lib/tenants/schema";
import { normalizarCelular, seleccionSchema } from "@/lib/validacion";
import { crearRepositorio, type BaseDatos } from "@/server/reservas/repositorio";
import { horariosLibres } from "@/server/reservas/servicio";

/**
 * Operaciones del panel. Todas reciben el negocio (slug) y lo incluyen en el WHERE: aunque se
 * conozca el id de una reserva de otro negocio, desde aquí no se puede leer ni tocar.
 */

export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

/** Reservas (de cualquier estado) que se solapan con [desde, hasta), ordenadas por inicio. */
export async function reservasEnRango(
  db: BaseDatos,
  slug: string,
  desde: Date,
  hasta: Date,
): Promise<Booking[]> {
  return db
    .select()
    .from(bookings)
    .where(
      and(eq(bookings.tenantSlug, slug), lt(bookings.startsAt, hasta), gt(bookings.endsAt, desde)),
    )
    .orderBy(asc(bookings.startsAt));
}

export async function bloqueosEnRango(
  db: BaseDatos,
  slug: string,
  desde: Date,
  hasta: Date,
): Promise<Block[]> {
  return db
    .select()
    .from(blocks)
    .where(and(eq(blocks.tenantSlug, slug), lt(blocks.startsAt, hasta), gt(blocks.endsAt, desde)))
    .orderBy(asc(blocks.startsAt));
}

export async function buscarReserva(
  db: BaseDatos,
  slug: string,
  id: string,
): Promise<Booking | null> {
  if (!UUID.test(id)) return null;
  const [fila] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.tenantSlug, slug)))
    .limit(1);
  return fila ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoEstado = "ok" | "no_encontrada" | "horario_ocupado";

export async function cambiarEstado(
  db: BaseDatos,
  slug: string,
  id: string,
  estado: EstadoReserva,
): Promise<ResultadoEstado> {
  if (!UUID.test(id) || !ESTADOS_RESERVA.includes(estado)) return "no_encontrada";
  try {
    const filas = await db
      .update(bookings)
      .set({ status: estado })
      .where(and(eq(bookings.id, id), eq(bookings.tenantSlug, slug)))
      .returning({ id: bookings.id });
    return filas.length > 0 ? "ok" : "no_encontrada";
  } catch (error) {
    // Reactivar una cita cancelada cuyo horario ya tomó otra persona.
    if (esTraslape(error)) return "horario_ocupado";
    throw error;
  }
}

export async function marcarRecordatorio(
  db: BaseDatos,
  slug: string,
  id: string,
  ahora: Date,
): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const filas = await db
    .update(bookings)
    .set({ reminderSentAt: ahora })
    .where(
      and(eq(bookings.id, id), eq(bookings.tenantSlug, slug), eq(bookings.status, "confirmada")),
    )
    .returning({ id: bookings.id });
  return filas.length > 0;
}

/** Citas confirmadas que empiezan el día `fecha` (Bogotá), para los recordatorios. */
export async function citasConfirmadasDelDia(
  db: BaseDatos,
  slug: string,
  fecha: string,
): Promise<Booking[]> {
  const { desde, hasta } = limitesDelDia(fecha);
  const filas = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantSlug, slug),
        eq(bookings.status, "confirmada"),
        gte(bookings.startsAt, desde),
        lt(bookings.startsAt, hasta),
      ),
    )
    .orderBy(asc(bookings.startsAt));
  return filas;
}

// --- Citas manuales ---------------------------------------------------------------------------

export const citaAdminSchema = seleccionSchema.extend({
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige una hora."),
  nombre: z
    .string()
    .trim()
    .min(2, "Escribe el nombre del cliente.")
    .max(80, "Nombre demasiado largo."),
  celular: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return "";
      const n = normalizarCelular(v);
      if (!n) {
        ctx.addIssue({
          code: "custom",
          message: "Escribe un celular colombiano de 10 dígitos o déjalo en blanco.",
        });
        return z.NEVER;
      }
      return n;
    }),
  notas: z.string().trim().max(300, "Máximo 300 caracteres.").optional(),
});

export type EntradaCitaAdmin = z.input<typeof citaAdminSchema>;

/** El panel no aplica la anticipación mínima ni la ventana de días: el negocio manda en su agenda. */
function conReglasDelPanel(tenant: Tenant): Tenant {
  return { ...tenant, anticipacionMinHoras: 0, diasReservables: 1 };
}

/**
 * Horarios libres para una cita manual. Incluye horas de hoy que ya pasaron (se registra a quien
 * ya está en la silla) y cualquier fecha: se calcula "desde el inicio de ese día".
 */
export async function horariosParaAdmin(
  db: BaseDatos,
  tenant: Tenant,
  seleccion: { servicioId: string; profesionalId: string; fecha: string },
): Promise<{ hora: string; profesionalId: string }[] | null> {
  const servicio = tenant.servicios.find((s) => s.id === seleccion.servicioId);
  if (!servicio) return null;
  if (
    seleccion.profesionalId !== "cualquiera" &&
    !tenant.profesionales.some((p) => p.id === seleccion.profesionalId)
  ) {
    return null;
  }
  const ahora = limitesDelDia(seleccion.fecha).desde;
  const libres = await horariosLibres(
    crearRepositorio(db),
    conReglasDelPanel(tenant),
    seleccion,
    servicio,
    ahora,
  );
  return libres.map((h) => ({ hora: h.hora, profesionalId: h.profesionalId }));
}

export type ResultadoCitaAdmin =
  | { ok: true; id: string }
  | { ok: false; codigo: "invalida" | "horario_ocupado"; errores?: Record<string, string> };

export async function crearCitaAdmin(
  db: BaseDatos,
  tenant: Tenant,
  entrada: unknown,
): Promise<ResultadoCitaAdmin> {
  const datos = citaAdminSchema.safeParse(entrada);
  if (!datos.success) {
    const errores: Record<string, string> = {};
    for (const i of datos.error.issues) errores[String(i.path[0] ?? "general")] ??= i.message;
    return { ok: false, codigo: "invalida", errores };
  }
  const d = datos.data;
  const servicio = tenant.servicios.find((s) => s.id === d.servicioId);
  if (!servicio)
    return { ok: false, codigo: "invalida", errores: { servicioId: "Servicio inexistente." } };

  for (let intento = 0; intento < 3; intento++) {
    const libres = await horariosParaAdmin(db, tenant, d);
    if (libres === null) {
      return {
        ok: false,
        codigo: "invalida",
        errores: { profesionalId: "Profesional inexistente." },
      };
    }
    const elegido = libres.find((h) => h.hora === d.hora);
    if (!elegido) return { ok: false, codigo: "horario_ocupado" };

    const inicio = instanteBogota(
      d.fecha,
      Number(d.hora.slice(0, 2)) * 60 + Number(d.hora.slice(3)),
    );
    const fin = new Date(inicio.getTime() + servicio.duracionMin * 60_000);
    try {
      const [fila] = await db
        .insert(bookings)
        .values({
          tenantSlug: tenant.slug,
          serviceId: servicio.id,
          professionalId: elegido.profesionalId,
          startsAt: inicio,
          endsAt: fin,
          customerName: d.nombre,
          customerPhone: d.celular,
          customerEmail: null,
          manageToken: randomBytes(32).toString("base64url"),
          source: "admin",
          notes: d.notas || null,
        })
        .returning({ id: bookings.id });
      return { ok: true, id: fila.id };
    } catch (error) {
      if (!esTraslape(error)) throw error;
    }
  }
  return { ok: false, codigo: "horario_ocupado" };
}

// --- Bloqueos ---------------------------------------------------------------------------------

const bloqueoSchema = z
  .object({
    /** Id de un profesional o "todos" para bloquear todo el local. */
    profesionalId: z.string().min(1).max(60),
    fecha: seleccionSchema.shape.fecha,
    desde: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige la hora de inicio."),
    hasta: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige la hora de fin."),
    motivo: z.string().trim().max(120, "Máximo 120 caracteres.").optional(),
  })
  .refine((b) => b.desde < b.hasta, {
    path: ["hasta"],
    message: "La hora de fin debe ser posterior al inicio.",
  });

export type ResultadoBloqueo =
  { ok: true; id: string; citasAfectadas: number } | { ok: false; errores: Record<string, string> };

export async function crearBloqueo(
  db: BaseDatos,
  tenant: Tenant,
  entrada: unknown,
): Promise<ResultadoBloqueo> {
  const datos = bloqueoSchema.safeParse(entrada);
  if (!datos.success) {
    const errores: Record<string, string> = {};
    for (const i of datos.error.issues) errores[String(i.path[0] ?? "general")] ??= i.message;
    return { ok: false, errores };
  }
  const b = datos.data;
  const profesionalId = b.profesionalId === "todos" ? null : b.profesionalId;
  if (profesionalId && !tenant.profesionales.some((p) => p.id === profesionalId)) {
    return { ok: false, errores: { profesionalId: "Profesional inexistente." } };
  }

  const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  const inicio = instanteBogota(b.fecha, aMin(b.desde));
  const fin = instanteBogota(b.fecha, aMin(b.hasta));

  const afectadas = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantSlug, tenant.slug),
        eq(bookings.status, "confirmada"),
        lt(bookings.startsAt, fin),
        gt(bookings.endsAt, inicio),
        profesionalId ? eq(bookings.professionalId, profesionalId) : undefined,
      ),
    );

  const [fila] = await db
    .insert(blocks)
    .values({
      tenantSlug: tenant.slug,
      professionalId: profesionalId,
      startsAt: inicio,
      endsAt: fin,
      reason: b.motivo || null,
    })
    .returning({ id: blocks.id });
  return { ok: true, id: fila.id, citasAfectadas: afectadas.length };
}

export async function borrarBloqueo(db: BaseDatos, slug: string, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const filas = await db
    .delete(blocks)
    .where(and(eq(blocks.id, id), eq(blocks.tenantSlug, slug)))
    .returning({ id: blocks.id });
  return filas.length > 0;
}
