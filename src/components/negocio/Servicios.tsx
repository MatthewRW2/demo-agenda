import Link from "next/link";
import { enlaceReservar } from "@/lib/enlaces";
import { formatearCOP } from "@/lib/moneda";
import type { Tenant } from "@/lib/tenants/schema";
import { formatearDuracion } from "@/lib/texto";

/**
 * Los servicios como un talonario: una lista reglada con líneas punteadas (como el corte de un tiquete),
 * el precio al borde y un botón por fila que entra al flujo con ese servicio ya elegido.
 */
export function Servicios({ tenant }: { tenant: Tenant }) {
  return (
    <section aria-labelledby="servicios" className="py-10 lg:py-14">
      <h2 id="servicios" className="titulo-seccion text-tinta mb-6">
        Servicios
      </h2>
      <ul className="border-linea border-y-2 border-dashed">
        {tenant.servicios.map((s) => (
          <li
            key={s.id}
            className="border-linea flex items-center justify-between gap-4 border-b-2 border-dashed py-5 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-tinta text-lg font-semibold text-pretty">{s.nombre}</p>
              <p className="text-tinta-suave cifras mt-0.5 text-sm">
                {formatearDuracion(s.duracionMin)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <p className="numero-grande text-primario-texto text-xl">{formatearCOP(s.precio)}</p>
              <Link
                href={enlaceReservar(tenant.slug, { servicio: s.id })}
                className="border-borde-control text-tinta inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold"
              >
                Reservar este
                <span className="sr-only"> servicio: {s.nombre}</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
