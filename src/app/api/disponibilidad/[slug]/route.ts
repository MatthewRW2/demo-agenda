import { getDb } from "@/db";
import { obtenerTenant } from "@/lib/tenants/obtener";
import { disponibilidadPublica } from "@/server/reservas/disponibilidadPublica";
import { crearRepositorio } from "@/server/reservas/repositorio";

export const dynamic = "force-dynamic";

/**
 * Turnos libres para la página pública: el próximo turno y qué profesionales tienen hoy. La página es
 * estática y rápida; esto se pide después de cargar. Es información pública (no incluye nada de los
 * clientes) y se guarda unos segundos en la caché del CDN para no consultar la base en cada visita.
 * Reservar siempre vuelve a validar el horario en el servidor.
 */
export async function GET(
  _peticion: Request,
  { params }: RouteContext<"/api/disponibilidad/[slug]">,
) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) return Response.json({ ok: false }, { status: 404 });

  try {
    const datos = await disponibilidadPublica(crearRepositorio(getDb()), tenant, new Date());
    return Response.json(
      { ok: true, ...datos },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (error) {
    console.error("Error calculando la disponibilidad pública:", error);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
