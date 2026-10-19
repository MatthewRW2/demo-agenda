import { formatearCOP } from "@/lib/moneda";
import type { Tenant } from "@/lib/tenants/schema";
import { formatearDuracion } from "@/lib/texto";

export function Servicios({ tenant }: { tenant: Tenant }) {
  return (
    <section aria-labelledby="servicios" className="px-4 py-8">
      <h2 id="servicios" className="mb-4 text-2xl font-bold">
        Servicios
      </h2>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
        {tenant.servicios.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-semibold">{s.nombre}</p>
              <p className="text-sm text-neutral-600">{formatearDuracion(s.duracionMin)}</p>
            </div>
            <p className="text-primario shrink-0 text-lg font-bold">{formatearCOP(s.precio)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
