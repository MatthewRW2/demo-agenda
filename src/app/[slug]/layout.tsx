import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { FranjaDemo } from "@/components/negocio/FranjaDemo";
import { variablesDeMarca } from "@/lib/paleta";
import { listarSlugs } from "@/lib/tenants/cargar";
import { obtenerTenant } from "@/lib/tenants/obtener";

export function generateStaticParams() {
  return listarSlugs().map((slug) => ({ slug }));
}

export default async function NegocioLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  // Colores del JSON + paleta derivada (papel, tinta, líneas...) con el contraste ya garantizado
  const marca = variablesDeMarca(tenant.colores) as CSSProperties;

  return (
    <div style={marca} className="flex flex-1 flex-col">
      {tenant.demo && <FranjaDemo />}
      {children}
    </div>
  );
}
