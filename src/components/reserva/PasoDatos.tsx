import { formatearCOP } from "@/lib/moneda";
import { formatearFechaLarga } from "@/lib/fechas";
import { formatearHora } from "@/lib/texto";
import type { DatosFormulario, TenantPublico } from "./tipos";

interface Props {
  tenant: TenantPublico;
  servicioId: string;
  profesionalId: string;
  fecha: string;
  hora: string;
  datos: DatosFormulario;
  errores: Record<string, string>;
  errorGeneral: string | null;
  enviando: boolean;
  onCambio: (campo: keyof DatosFormulario, valor: string) => void;
  onEnviar: () => void;
}

const CAMPO =
  "min-h-12 w-full rounded-xl border-2 border-neutral-300 bg-white px-4 text-base aria-[invalid=true]:border-red-600";

function Campo(props: {
  id: keyof DatosFormulario;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  valor: string;
  onCambio: Props["onCambio"];
  tipo: string;
  modo?: "tel" | "email" | "text";
  autoComplete: string;
}) {
  const { id, etiqueta, ayuda, error, valor, onCambio, tipo, modo, autoComplete } = props;
  const descripcion = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {etiqueta}
      </label>
      <input
        id={id}
        name={id}
        type={tipo}
        inputMode={modo}
        autoComplete={autoComplete}
        value={valor}
        onChange={(e) => onCambio(id, e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion || undefined}
        className={CAMPO}
      />
      {ayuda && (
        <p id={`${id}-ayuda`} className="mt-1 text-sm text-neutral-600">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function PasoDatos({
  tenant,
  servicioId,
  profesionalId,
  fecha,
  hora,
  datos,
  errores,
  errorGeneral,
  enviando,
  onCambio,
  onEnviar,
}: Props) {
  const servicio = tenant.servicios.find((s) => s.id === servicioId);
  const profesional = tenant.profesionales.find((p) => p.id === profesionalId);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar();
      }}
      className="flex flex-col gap-5"
    >
      <dl className="rounded-xl bg-neutral-100 p-4 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-neutral-600">Servicio</dt>
          <dd className="text-right font-semibold">
            {servicio?.nombre} · {servicio && formatearCOP(servicio.precio)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-neutral-600">Con</dt>
          <dd className="font-semibold">{profesional?.nombre ?? "El primero que esté libre"}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-neutral-600">Cuándo</dt>
          <dd className="text-right font-semibold">
            {formatearFechaLarga(fecha)}, {formatearHora(hora)}
          </dd>
        </div>
      </dl>

      <Campo
        id="nombre"
        etiqueta="Tu nombre"
        tipo="text"
        autoComplete="name"
        valor={datos.nombre}
        error={errores.nombre}
        onCambio={onCambio}
      />
      <Campo
        id="celular"
        etiqueta="Celular"
        ayuda="Te escribiremos por WhatsApp si hay algún cambio."
        tipo="tel"
        modo="tel"
        autoComplete="tel-national"
        valor={datos.celular}
        error={errores.celular}
        onCambio={onCambio}
      />
      <Campo
        id="correo"
        etiqueta="Correo (opcional)"
        ayuda="Si lo escribes, te enviamos la confirmación."
        tipo="email"
        modo="email"
        autoComplete="email"
        valor={datos.correo}
        error={errores.correo}
        onCambio={onCambio}
      />

      {errorGeneral && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900" role="alert">
          {errorGeneral}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="bg-acento text-sobre-acento min-h-14 w-full rounded-xl text-lg font-bold disabled:opacity-60"
      >
        {enviando ? "Reservando…" : `Confirmar ${tenant.textos.reserva}`}
      </button>
    </form>
  );
}
