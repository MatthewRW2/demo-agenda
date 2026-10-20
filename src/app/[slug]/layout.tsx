import type { CSSProperties } from "react";
import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { FranjaDemo } from "@/components/negocio/FranjaDemo";
import { variablesDeMarca } from "@/lib/paleta";
import { listarSlugs } from "@/lib/tenants/cargar";
import { obtenerTenant } from "@/lib/tenants/obtener";

export function generateStaticParams() {
  return listarSlugs().map((slug) => ({ slug }));
}

/** La barra del navegador en el celular toma el color de la marca. */
export async function generateViewport({ params }: LayoutProps<"/[slug]">): Promise<Viewport> {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  return tenant ? { themeColor: tenant.colores.primario } : {};
}

export default async function NegocioLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  // Colores del JSON + paleta derivada (papel, tinta, líneas...) con el contraste ya garantizado
  const marca = variablesDeMarca(tenant.colores) as CSSProperties;

  return (
    <div style={marca} className="flex flex-1 flex-col">
      <a
        href="#contenido"
        className="bg-tinta text-papel sr-only z-50 rounded-xl px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      {tenant.demo && <FranjaDemo />}
      {children}
    </div>
  );
}
