import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarraReservar } from "@/components/negocio/BarraReservar";
import { DisponibilidadProvider } from "@/components/negocio/DisponibilidadProvider";
import { Portada } from "@/components/negocio/Portada";
import { Profesionales } from "@/components/negocio/Profesionales";
import { Resenas } from "@/components/negocio/Resenas";
import { Servicios } from "@/components/negocio/Servicios";
import { TarjetaTurno } from "@/components/negocio/TarjetaTurno";
import { Visita } from "@/components/negocio/Visita";
import { obtenerTenant } from "@/lib/tenants/obtener";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) return {};

  const titulo = `${tenant.nombre} · Reserva tu ${tenant.textos.reserva} en línea`;
  const descripcion = `${tenant.eslogan}. ${tenant.direccion}.`;
  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      type: "website",
      locale: "es_CO",
      siteName: tenant.nombre,
    },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}

export default async function PaginaNegocio({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  return (
    <DisponibilidadProvider slug={tenant.slug}>
      <Portada tenant={tenant} />

      <div className="bg-papel text-tinta flex-1">
        {/*
          Dos columnas en escritorio: el contenido a la izquierda y la tarjeta de turno a la derecha,
          fija al desplazar. La tarjeta va primero en el código (y en el celular) y se monta sobre el
          borde inferior de la portada con un margen negativo.
        */}
        <div className="mx-auto max-w-6xl px-4 pb-24 md:pb-12 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-14">
          <aside
            aria-label="Próximo turno"
            className="relative z-10 -mt-24 md:-mt-32 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:-mt-[16rem] lg:self-start"
          >
            <TarjetaTurno
              slug={tenant.slug}
              servicios={tenant.servicios}
              profesionales={tenant.profesionales.map((p) => ({ id: p.id, nombre: p.nombre }))}
            />
          </aside>

          <main className="min-w-0 lg:col-start-1 lg:row-start-1">
            <Servicios tenant={tenant} />
            <Profesionales tenant={tenant} />
            <Resenas tenant={tenant} />
            <Visita tenant={tenant} />
          </main>
        </div>
      </div>

      <footer className="bg-papel-2 text-tinta-suave px-4 py-8 pb-28 text-center text-sm md:pb-8">
        © {tenant.nombre}
      </footer>
      <BarraReservar slug={tenant.slug} textoReserva={tenant.textos.reserva} />
    </DisponibilidadProvider>
  );
}
