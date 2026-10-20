import { formatearFechaCorta, formatearFechaLarga } from "@/lib/fechas";
import { agruparPorMomento } from "@/lib/momentos";
import { formatearHora } from "@/lib/texto";
import type { EstadoHorarios } from "./tipos";

interface Props {
  dias: string[];
  fecha: string | null;
  horarios: EstadoHorarios;
  onElegirFecha: (fecha: string) => void;
  onElegirHora: (hora: string) => void;
  onReintentar: () => void;
  /** Hora elegida, si la pantalla la deja marcada (la de cambiar cita). */
  horaElegida?: string | null;
}

export function PasoFechaHora({
  dias,
  fecha,
  horarios,
  onElegirFecha,
  onElegirHora,
  onReintentar,
  horaElegida,
}: Props) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-tinta mb-3 text-xl font-bold">Día</h2>
        <ul
          className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-2"
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
                  className={`relative flex min-h-24 w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 transition ${
                    elegido
                      ? "border-primario bg-primario text-sobre-primario"
                      : "hover:border-primario border-linea text-tinta bg-white"
                  }`}
                >
                  <span className="text-xs font-semibold uppercase">{c.diaSemana}</span>
                  <span className="numero-grande text-2xl">{c.dia}</span>
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
          <h2 className="font-display text-tinta mb-4 text-xl font-bold">
            Hora · <span className="font-semibold">{formatearFechaLarga(fecha)}</span>
          </h2>

          {horarios.estado === "cargando" && (
            <div aria-hidden className="grid animate-pulse grid-cols-3 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="bg-papel-2 h-14 rounded-xl" />
              ))}
            </div>
          )}
          {horarios.estado === "cargando" && (
            <p className="sr-only" role="status">
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
            <p className="bg-papel-2 text-tinta rounded-xl p-4">
              Ese día ya no hay horarios libres. Prueba con otro día.
            </p>
          )}

          {horarios.estado === "listo" && horarios.horas.length > 0 && (
            <div className="flex flex-col gap-6">
              {agruparPorMomento(horarios.horas).map((g) => (
                <section key={g.momento} aria-labelledby={`momento-${g.momento}`}>
                  <h3
                    id={`momento-${g.momento}`}
                    className="text-tinta-suave mb-2.5 text-sm font-semibold"
                  >
                    {g.titulo}
                  </h3>
                  <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {g.horas.map((h) => (
                      <li key={h}>
                        <button
                          type="button"
                          aria-pressed={horaElegida ? h === horaElegida : undefined}
                          onClick={() => onElegirHora(h)}
                          className={`cifras min-h-14 w-full rounded-xl border-2 px-1 text-base font-bold transition ${
                            h === horaElegida
                              ? "border-primario bg-primario text-sobre-primario"
                              : "hover:border-primario border-linea text-tinta bg-white"
                          }`}
                        >
                          {formatearHora(h)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
