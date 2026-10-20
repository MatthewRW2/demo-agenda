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
              <span className="text-tinta block text-lg font-semibold">{s.nombre}</span>
              <span className="text-tinta-suave cifras block text-sm">
                {formatearDuracion(s.duracionMin)}
              </span>
            </span>
            <span className="numero-grande text-primario-texto shrink-0 text-xl">
              {formatearCOP(s.precio)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
