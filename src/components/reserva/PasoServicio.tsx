import { formatearCOP } from "@/lib/moneda";
import { formatearDuracion } from "@/lib/texto";
import { CLASE_OPCION, type TenantPublico } from "./tipos";

interface Props {
  tenant: TenantPublico;
  onElegir: (servicioId: string) => void;
}

export function PasoServicio({ tenant, onElegir }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {tenant.servicios.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onElegir(s.id)} className={CLASE_OPCION}>
            <span>
              <span className="block font-semibold">{s.nombre}</span>
              <span className="block text-sm text-neutral-600">
                {formatearDuracion(s.duracionMin)}
              </span>
            </span>
            <span className="text-primario shrink-0 text-lg font-bold">
              {formatearCOP(s.precio)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
