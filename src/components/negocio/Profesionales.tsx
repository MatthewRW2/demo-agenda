import type { Tenant } from "@/lib/tenants/schema";
import { capitalizar, pluralizar } from "@/lib/texto";
import { Avatar } from "./Avatar";

export function Profesionales({ tenant }: { tenant: Tenant }) {
  const titulo = `Nuestros ${pluralizar(tenant.textos.profesional)}`;
  const nombresServicio = new Map(tenant.servicios.map((s) => [s.id, s.nombre]));

  return (
    <section aria-labelledby="equipo" className="bg-neutral-50 px-4 py-8">
      <h2 id="equipo" className="mb-4 text-2xl font-bold">
        {capitalizar(titulo)}
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tenant.profesionales.map((p) => (
          <li
            key={p.id}
            className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-center"
          >
            <Avatar src={p.foto} nombre={p.nombre} tamano={88} />
            <p className="font-semibold">{p.nombre}</p>
            <p className="text-sm text-neutral-600">
              {p.servicios.map((id) => nombresServicio.get(id)).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
