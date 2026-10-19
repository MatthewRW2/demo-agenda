import { getDb } from "@/db";
import { cargarTenant, listarSlugs } from "@/lib/tenants/cargar";
import { autorizadoCron } from "@/server/demo/cron";
import { sembrarDemo } from "@/server/demo/sembrar";

export const dynamic = "force-dynamic";

/**
 * Cron diario de Vercel: vuelve a sembrar los datos de todos los negocios marcados como demo.
 * Vercel llama con GET y `Authorization: Bearer <CRON_SECRET>`; sin ese encabezado responde 401.
 */
export async function GET(request: Request) {
  if (!autorizadoCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const ahora = new Date();
  const resultados: { slug: string; reservas?: number; bloqueos?: number; error?: string }[] = [];
  for (const slug of listarSlugs()) {
    try {
      const tenant = cargarTenant(slug);
      if (!tenant?.demo) continue; // los negocios reales jamás se tocan
      resultados.push({ slug, ...(await sembrarDemo(getDb(), tenant, ahora)) });
    } catch (error) {
      console.error(`No se pudo restablecer la demo de ${slug}:`, error);
      resultados.push({ slug, error: "No se pudo restablecer" });
    }
  }

  const fallo = resultados.some((r) => r.error);
  return Response.json({ ok: !fallo, negocios: resultados }, { status: fallo ? 500 : 200 });
}
