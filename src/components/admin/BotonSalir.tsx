"use client";

import { useRouter } from "next/navigation";
import { cerrarSesionAccion } from "@/app/[slug]/admin/acciones";

export function BotonSalir({ slug }: { slug: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await cerrarSesionAccion(slug);
        router.refresh();
      }}
      className="min-h-12 px-3 text-sm font-semibold underline underline-offset-4"
    >
      Salir
    </button>
  );
}
