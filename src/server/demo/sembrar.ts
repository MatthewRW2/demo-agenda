import { eq } from "drizzle-orm";
import { blocks, bookings } from "@/db/schema";
import type { Tenant } from "@/lib/tenants/schema";
import type { BaseDatos } from "@/server/reservas/repositorio";
import { generarDatosDemo, type OpcionesDemo } from "./datos";

export interface ResumenSiembra {
  reservas: number;
  bloqueos: number;
}

/**
 * Reemplaza TODAS las citas y bloqueos de un negocio por datos de ejemplo. Es destructivo, así que
 * solo se permite en negocios marcados `"demo": true`; para un negocio real lanza un error antes de
 * tocar la base.
 *
 * No es atómico (el driver HTTP de Neon no admite transacciones): si fallara el insert después de
 * borrar, el negocio queda vacío hasta la siguiente restauración. Si dos restauraciones corren a la
 * vez, la segunda inserción puede ser rechazada por la restricción anti-traslape; el resultado sigue
 * siendo un conjunto coherente.
 */
export async function sembrarDemo(
  db: BaseDatos,
  tenant: Tenant,
  ahora: Date,
  opciones?: OpcionesDemo,
): Promise<ResumenSiembra> {
  if (!tenant.demo) {
    throw new Error(
      `"${tenant.slug}" no es un negocio de demostración ("demo": false): no se borran ni se siembran datos.`,
    );
  }
  const { reservas, bloqueos } = generarDatosDemo(tenant, ahora, opciones);

  await db.delete(bookings).where(eq(bookings.tenantSlug, tenant.slug));
  await db.delete(blocks).where(eq(blocks.tenantSlug, tenant.slug));
  if (reservas.length > 0) await db.insert(bookings).values(reservas);
  if (bloqueos.length > 0) await db.insert(blocks).values(bloqueos);

  return { reservas: reservas.length, bloqueos: bloqueos.length };
}
