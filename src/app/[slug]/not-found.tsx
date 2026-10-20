"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

/** 404 dentro de un negocio (por ejemplo, un enlace de cita incompleto): conserva sus colores. */
export default function NoEncontradaEnNegocio() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <main
      id="contenido"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <h1 className="text-2xl font-bold">No encontramos esa página</h1>
      <p className="text-neutral-700">
        Puede que el enlace esté incompleto o que la cita ya no exista. Si lo recibiste por correo o
        WhatsApp, vuelve a abrirlo completo.
      </p>
      <Link
        href={`/${slug}`}
        className="bg-acento text-sobre-acento inline-flex min-h-12 items-center rounded-xl px-5 font-bold"
      >
        Ir al inicio del negocio
      </Link>
    </main>
  );
}
