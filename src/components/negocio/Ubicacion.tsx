import { IconoUbicacion } from "@/components/iconos";
import { enlaceComoLlegar, urlMapaEmbebido } from "@/lib/enlaces";
import type { Tenant } from "@/lib/tenants/schema";

export function Ubicacion({ tenant }: { tenant: Tenant }) {
  return (
    <section aria-labelledby="ubicacion" className="bg-neutral-50 px-4 py-8">
      <h2 id="ubicacion" className="mb-2 text-2xl font-bold">
        Dónde estamos
      </h2>
      <p className="mb-4 flex items-start gap-2 text-neutral-800">
        <IconoUbicacion className="mt-0.5 shrink-0" />
        <span>{tenant.direccion}</span>
      </p>
      <iframe
        title={`Mapa de ${tenant.nombre}`}
        src={urlMapaEmbebido(tenant.direccion)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-64 w-full rounded-xl border border-neutral-200"
      />
      <a
        href={enlaceComoLlegar(tenant.direccion)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primario mt-3 inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
      >
        Cómo llegar<span className="sr-only"> (abre Google Maps en otra pestaña)</span>
      </a>
    </section>
  );
}
