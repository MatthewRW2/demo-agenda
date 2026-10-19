import { Avatar } from "@/components/negocio/Avatar";
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
          <span>
            <span className="block font-semibold">Cualquiera</span>
            <span className="block text-sm text-neutral-600">El primero que esté libre</span>
          </span>
        </button>
      </li>
      {disponibles.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onElegir(p.id)} className={CLASE_OPCION}>
            <span className="flex items-center gap-3">
              <Avatar src={p.foto} nombre={p.nombre} tamano={44} />
              <span className="font-semibold">{p.nombre}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
