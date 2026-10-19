import Link from "next/link";
import { IconoCalendario } from "@/components/iconos";
import type { Tenant } from "@/lib/tenants/schema";
import { Avatar } from "./Avatar";

export function Portada({ tenant }: { tenant: Tenant }) {
  return (
    <header className="bg-primario text-sobre-primario px-4 pt-12 pb-10 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        <Avatar src={tenant.logo} nombre={`Logo de ${tenant.nombre}`} tamano={112} prioridad />
        <h1 className="text-3xl leading-tight font-bold text-balance">{tenant.nombre}</h1>
        <p className="text-lg text-pretty opacity-90">{tenant.eslogan}</p>
        <Link
          href={`/${tenant.slug}/reservar`}
          className="bg-acento text-sobre-acento mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-6 text-lg font-bold shadow-lg transition active:scale-[0.98]"
        >
          <IconoCalendario width={22} height={22} />
          Reservar {tenant.textos.reserva}
        </Link>
      </div>
    </header>
  );
}
