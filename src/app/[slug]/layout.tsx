import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { FranjaDemo } from "@/components/negocio/FranjaDemo";
import { colorTextoSobre } from "@/lib/color";
import { listarSlugs } from "@/lib/tenants/cargar";
import { obtenerTenant } from "@/lib/tenants/obtener";

export function generateStaticParams() {
  return listarSlugs().map((slug) => ({ slug }));
}

export default async function NegocioLayout({ children, params }: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  const { primario, acento } = tenant.colores;
  const marca = {
    "--primario": primario,
    "--acento": acento,
    "--sobre-primario": colorTextoSobre(primario),
    "--sobre-acento": colorTextoSobre(acento),
  } as CSSProperties;

  return (
    <div style={marca} className="flex flex-1 flex-col">
      {tenant.demo && <FranjaDemo />}
      {children}
    </div>
  );
}
