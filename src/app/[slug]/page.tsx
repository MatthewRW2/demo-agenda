import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarraReservar } from "@/components/negocio/BarraReservar";
import { Contacto } from "@/components/negocio/Contacto";
import { Horario } from "@/components/negocio/Horario";
import { Portada } from "@/components/negocio/Portada";
import { Profesionales } from "@/components/negocio/Profesionales";
import { Servicios } from "@/components/negocio/Servicios";
import { Ubicacion } from "@/components/negocio/Ubicacion";
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
    <>
      <Portada tenant={tenant} />
      <main className="mx-auto w-full max-w-3xl flex-1 pb-24 md:pb-8">
        <Servicios tenant={tenant} />
        <Profesionales tenant={tenant} />
        <Horario tenant={tenant} />
        <Ubicacion tenant={tenant} />
        <Contacto tenant={tenant} />
      </main>
      <footer className="border-t border-neutral-200 px-4 py-6 pb-24 text-center text-sm text-neutral-600 md:pb-6">
        © {tenant.nombre}
      </footer>
      <BarraReservar tenant={tenant} />
    </>
  );
}
