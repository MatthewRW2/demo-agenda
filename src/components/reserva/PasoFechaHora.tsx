import { formatearFechaCorta, formatearFechaLarga } from "@/lib/fechas";
import { formatearHora } from "@/lib/texto";
import type { EstadoHorarios } from "./tipos";

interface Props {
  dias: string[];
  fecha: string | null;
  horarios: EstadoHorarios;
  onElegirFecha: (fecha: string) => void;
  onElegirHora: (hora: string) => void;
  onReintentar: () => void;
}

export function PasoFechaHora({
  dias,
  fecha,
  horarios,
  onElegirFecha,
  onElegirHora,
  onReintentar,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 font-semibold">Día</h2>
        <ul
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2"
          aria-label="Días disponibles"
        >
          {dias.map((d) => {
            const c = formatearFechaCorta(d);
            const elegido = d === fecha;
            return (
              <li key={d} className="snap-start">
                <button
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => onElegirFecha(d)}
                  className={`relative flex min-h-20 w-16 flex-col items-center justify-center rounded-xl border-2 transition ${
                    elegido
                      ? "border-primario bg-primario text-sobre-primario"
                      : "hover:border-primario border-neutral-200 bg-white"
                  }`}
                >
                  <span className="text-xs uppercase">{c.diaSemana}</span>
                  <span className="text-xl font-bold">{c.dia}</span>
                  <span className="text-xs">{c.mes}</span>
                  <span className="sr-only">, {formatearFechaLarga(d)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {fecha && (
        <div aria-live="polite">
          <h2 className="mb-2 font-semibold">Hora · {formatearFechaLarga(fecha)}</h2>

          {horarios.estado === "cargando" && (
            <p className="py-6 text-center text-neutral-600" role="status">
              Buscando horarios…
            </p>
          )}

          {horarios.estado === "error" && (
            <div
              className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
              role="alert"
            >
              <p>{horarios.mensaje}</p>
              <button
                type="button"
                onClick={onReintentar}
                className="mt-2 min-h-12 font-semibold underline underline-offset-4"
              >
                Reintentar
              </button>
            </div>
          )}

          {horarios.estado === "listo" && horarios.horas.length === 0 && (
            <p className="rounded-xl bg-neutral-100 p-4 text-neutral-800">
              Ese día ya no hay horarios libres. Prueba con otro día.
            </p>
          )}

          {horarios.estado === "listo" && horarios.horas.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {horarios.horas.map((h) => (
                <li key={h}>
                  <button
                    type="button"
                    onClick={() => onElegirHora(h)}
                    className="hover:border-primario min-h-12 w-full rounded-xl border-2 border-neutral-200 bg-white px-1 text-sm font-semibold transition"
                  >
                    {formatearHora(h)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
