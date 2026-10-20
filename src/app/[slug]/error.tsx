"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ErrorEnNegocio({ error, retry }: { error: unknown; retry: () => void }) {
  const { slug } = useParams<{ slug: string }>();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-bold">Algo no salió como esperábamos</h1>
      <p className="text-neutral-700">
        No pudimos cargar esta pantalla. Suele ser algo pasajero: inténtalo de nuevo en unos
        segundos.
      </p>
      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="bg-acento text-sobre-acento min-h-12 rounded-xl px-5 font-bold"
        >
          Intentar de nuevo
        </button>
        <Link
          href={`/${slug}`}
          className="border-primario text-primario inline-flex min-h-12 items-center justify-center rounded-xl border-2 px-5 font-semibold"
        >
          Ir al inicio del negocio
        </Link>
      </div>
    </main>
  );
}
