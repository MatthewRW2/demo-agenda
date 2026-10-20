"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarRecordatorioAccion } from "@/app/[slug]/admin/acciones";
import { IconoWhatsApp } from "@/components/iconos";

interface Props {
  slug: string;
  id: string;
  hora: string;
  cliente: string;
  detalle: string;
  /** Enlace wa.me con el mensaje ya escrito; null si la cita no tiene celular. */
  href: string | null;
  /** Instante (ISO) en que se envió, o null. */
  enviadoEn: string | null;
}

export function FilaRecordatorio({ slug, id, hora, cliente, detalle, href, enviadoEn }: Props) {
  const router = useRouter();
  const [enviado, setEnviado] = useState(enviadoEn !== null);
  const [error, setError] = useState<string | null>(null);

  async function alAbrirWhatsApp() {
    // El enlace se abre solo (es un <a>); aquí solo se deja constancia de que se envió.
    setError(null);
    try {
      const r = await marcarRecordatorioAccion(slug, id);
      if (r.ok) {
        setEnviado(true);
        router.refresh();
      } else {
        setError(r.mensaje);
      }
    } catch {
      setError("Se abrió WhatsApp pero no pudimos marcarlo como enviado.");
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold">
          {hora} · {cliente}
        </p>
        <p className="text-tinta-suave text-sm">{detalle}</p>
        {enviado && (
          <p
            className="mt-1 text-sm font-semibold text-emerald-800"
            data-testid="recordatorio-enviado"
          >
            ✓ Recordatorio enviado
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void alAbrirWhatsApp()}
          className="border-primario-texto text-primario-texto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-4 font-semibold"
        >
          <IconoWhatsApp />
          {enviado ? "Enviar de nuevo" : "Enviar recordatorio"}
          <span className="sr-only"> a {cliente} (abre WhatsApp en otra pestaña)</span>
        </a>
      ) : (
        <p className="text-tinta-suave text-sm">Sin celular: no se puede enviar</p>
      )}
    </li>
  );
}
