import Link from "next/link";
import { enlaceReservar } from "@/lib/enlaces";
import type { Tenant } from "@/lib/tenants/schema";
import { capitalizar, pluralizar } from "@/lib/texto";
import { IndicadorTurnosHoy } from "./IndicadorTurnosHoy";
import { Retrato } from "./Retrato";

export function Profesionales({ tenant }: { tenant: Tenant }) {
  const titulo = capitalizar(`Nuestros ${pluralizar(tenant.textos.profesional)}`);
  const nombresServicio = new Map(tenant.servicios.map((s) => [s.id, s.nombre]));

  return (
    <section aria-labelledby="equipo" className="py-10 lg:py-14">
      <h2 id="equipo" className="titulo-seccion text-tinta mb-6">
        {titulo}
      </h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
        {tenant.profesionales.map((p) => (
          <li key={p.id} className="flex flex-col gap-3 [&>a]:mt-auto">
            <Retrato foto={p.foto} nombre={p.nombre} />
            <div className="flex flex-col gap-1">
              <p className="font-display text-tinta text-xl font-bold">{p.nombre}</p>
              <p className="text-tinta-suave text-sm text-pretty">
                {p.servicios.map((id) => nombresServicio.get(id)).join(" · ")}
              </p>
              <IndicadorTurnosHoy profesionalId={p.id} />
            </div>
            <Link
              href={enlaceReservar(tenant.slug, { profesional: p.id })}
              className="border-borde-control text-tinta inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-center text-sm font-semibold"
            >
              Reservar con {p.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
