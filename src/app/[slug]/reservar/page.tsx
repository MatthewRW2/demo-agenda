import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlujoReserva } from "@/components/reserva/FlujoReserva";
import { diasDisponibles } from "@/lib/disponibilidad";
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

export default async function PaginaReservar({ params }: PageProps<"/[slug]/reservar">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  const { nombre, textos, servicios, profesionales } = tenant;
  return (
    <main className="flex-1">
      <FlujoReserva
        tenant={{ slug: tenant.slug, nombre, textos, servicios, profesionales }}
        dias={diasDisponibles(tenant, new Date())}
      />
    </main>
  );
}
