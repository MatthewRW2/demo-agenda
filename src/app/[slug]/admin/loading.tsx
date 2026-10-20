/** Mientras el panel consulta la agenda: esqueleto simple y anunciado a lectores de pantalla. */
export default function CargandoPanel() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <p className="text-tinta-suave mb-4">Cargando el panel…</p>
      <div aria-hidden className="flex animate-pulse flex-col gap-3">
        <div className="bg-papel-2 h-8 w-2/3 rounded-lg" />
        <div className="bg-papel-2 h-12 w-full rounded-xl" />
        <div className="bg-papel-2 h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
