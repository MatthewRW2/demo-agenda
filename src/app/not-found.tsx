import Link from "next/link";

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-6xl font-bold text-neutral-600" aria-hidden>
        404
      </p>
      <h1 className="text-2xl font-bold">No encontramos esa página</h1>
      <p className="text-neutral-700">
        Puede que el enlace esté incompleto o que ya no exista. Revisa que esté bien escrito.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-12 items-center rounded-xl border-2 border-neutral-900 px-5 font-semibold"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
