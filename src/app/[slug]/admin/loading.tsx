/** Mientras el panel consulta la agenda: esqueleto simple y anunciado a lectores de pantalla. */
export default function CargandoPanel() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <p className="mb-4 text-neutral-700">Cargando el panel…</p>
      <div aria-hidden className="flex animate-pulse flex-col gap-3">
        <div className="h-8 w-2/3 rounded-lg bg-neutral-200" />
        <div className="h-12 w-full rounded-xl bg-neutral-200" />
        <div className="h-72 w-full rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
}
