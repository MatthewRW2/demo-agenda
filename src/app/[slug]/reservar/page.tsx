import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlujoReserva } from "@/components/reserva/FlujoReserva";
import { diasDisponibles } from "@/lib/disponibilidad";
import { preseleccionDesdeConsulta } from "@/lib/preseleccion";
import { obtenerTenant } from "@/lib/tenants/obtener";

// Los días reservables dependen de la fecha de hoy: se calculan en cada visita.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[slug]/reservar">): Promise<Metadata> {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) return {};
  return {
    title: `Reservar ${tenant.textos.reserva} · ${tenant.nombre}`,
    robots: { index: false },
  };
}

export default async function PaginaReservar({
  params,
  searchParams,
}: PageProps<"/[slug]/reservar">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  const { nombre, textos, servicios, profesionales, whatsapp, logo } = tenant;
  const dias = diasDisponibles(tenant, new Date());
  return (
    <main className="flex flex-1 flex-col">
      <FlujoReserva
        tenant={{ slug: tenant.slug, nombre, textos, servicios, profesionales, whatsapp, logo }}
        dias={dias}
        inicial={preseleccionDesdeConsulta(tenant, dias, await searchParams)}
      />
    </main>
  );
}
