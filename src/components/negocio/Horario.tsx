import { DIAS, type Tenant } from "@/lib/tenants/schema";
import { NOMBRE_DIA, formatearHora } from "@/lib/texto";

export function Horario({ tenant }: { tenant: Tenant }) {
  return (
    <section aria-labelledby="horario" className="px-4 py-8">
      <h2 id="horario" className="mb-4 text-2xl font-bold">
        Horario
      </h2>
      <dl className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
        {DIAS.map((dia) => {
          const rango = tenant.horario[dia];
          return (
            <div key={dia} className="flex justify-between gap-4 p-3 px-4">
              <dt className="font-medium">{NOMBRE_DIA[dia]}</dt>
              <dd className={rango ? "" : "text-neutral-600"}>
                {rango ? `${formatearHora(rango[0])} – ${formatearHora(rango[1])}` : "Cerrado"}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
