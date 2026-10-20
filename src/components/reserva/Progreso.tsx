import { ETIQUETA_PASO, type Paso } from "./tipos";

interface Props {
  pasos: Paso[];
  actual: Paso;
  /** Los pasos ya hechos se pueden tocar para volver a ellos. */
  onIr: (paso: Paso) => void;
}

/**
 * Pasos numerados con el nombre de cada uno. Los hechos llevan una marca y se pueden tocar para volver;
 * el actual lleva `aria-current="step"`. En pantallas angostas solo el actual muestra su nombre.
 */
export function Progreso({ pasos, actual, onIr }: Props) {
  const indiceActual = pasos.indexOf(actual);

  return (
    <nav aria-label="Progreso">
      <ol className="flex items-center">
        {pasos.map((p, i) => {
          const hecho = i < indiceActual;
          const esActual = i === indiceActual;
          const marca = (
            <span
              aria-hidden
              className={`cifras flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                hecho
                  ? "border-primario bg-primario text-sobre-primario"
                  : esActual
                    ? "border-primario text-tinta bg-white"
                    : "border-linea text-tinta-suave bg-white"
              }`}
            >
              {hecho ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </span>
          );
          const nombre = (
            <span
              className={`text-sm whitespace-nowrap ${esActual ? "text-tinta font-bold" : "text-tinta-suave sr-only font-medium sm:not-sr-only"}`}
            >
              {ETIQUETA_PASO[p]}
            </span>
          );

          return (
            <li
              key={p}
              aria-current={esActual ? "step" : undefined}
              className={`flex items-center ${i < pasos.length - 1 ? "flex-1" : ""}`}
            >
              {hecho ? (
                <button
                  type="button"
                  onClick={() => onIr(p)}
                  className="-m-2 flex min-h-12 items-center gap-2 rounded-xl p-2"
                >
                  {marca}
                  {nombre}
                  <span className="sr-only">(paso hecho, volver)</span>
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  {marca}
                  {nombre}
                </span>
              )}
              {i < pasos.length - 1 && (
                <span
                  aria-hidden
                  className={`mx-2 h-0.5 min-w-3 flex-1 rounded-full ${i < indiceActual ? "bg-primario" : "bg-linea"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
