import { Retrato } from "@/components/negocio/Retrato";
import { CLASE_OPCION, type TenantPublico } from "./tipos";

interface Props {
  tenant: TenantPublico;
  servicioId: string;
  onElegir: (profesionalId: string) => void;
}

export function PasoProfesional({ tenant, servicioId, onElegir }: Props) {
  const disponibles = tenant.profesionales.filter((p) => p.servicios.includes(servicioId));

  return (
    <ul className="flex flex-col gap-3">
      <li>
        <button type="button" onClick={() => onElegir("cualquiera")} className={CLASE_OPCION}>
          <span className="flex items-center gap-4">
            <span
              aria-hidden
              className="bg-papel-2 text-tinta flex aspect-[4/5] w-12 shrink-0 items-center justify-center rounded-xl"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M15.5 5.2a3.2 3.2 0 010 5.6M17.5 14.8c1.7.6 2.7 2 3 4.2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span>
              <span className="text-tinta block text-lg font-semibold">Cualquiera</span>
              <span className="text-tinta-suave block text-sm">El primero que esté libre</span>
            </span>
          </span>
        </button>
      </li>
      {disponibles.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onElegir(p.id)} className={CLASE_OPCION}>
            <span className="flex items-center gap-4">
              <span className="w-12 shrink-0">
                <Retrato foto={p.foto} nombre={p.nombre} sizes="96px" pequeno />
              </span>
              <span className="text-tinta text-lg font-semibold">{p.nombre}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
