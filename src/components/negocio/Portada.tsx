import Image from "next/image";
import Link from "next/link";
import { IconoCalendario } from "@/components/iconos";
import { enlaceReservar } from "@/lib/enlaces";
import type { Tenant } from "@/lib/tenants/schema";
import { Avatar } from "./Avatar";
import { ChipApertura } from "./ChipApertura";

/**
 * Portada: foto del negocio bajo una capa de su color primario (para que el texto siempre se lea),
 * nombre, eslogan y estado de apertura. Sin foto, queda un campo liso del color primario con el logo
 * grande: no se inventa ninguna imagen. La tarjeta de turno se "monta" sobre el borde inferior.
 */
export function Portada({ tenant }: { tenant: Tenant }) {
  const sinFoto = !tenant.imagenPortada;

  return (
    <header className="bg-primario text-sobre-primario relative isolate overflow-hidden">
      {tenant.imagenPortada && (
        <Image
          src={tenant.imagenPortada}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
      )}
      {/* Capa de color: más densa abajo y a la izquierda, donde va el texto */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--primario) 95%, transparent), color-mix(in srgb, var(--primario) 74%, transparent) 55%, color-mix(in srgb, var(--primario) 62%, transparent))",
        }}
      />
      {!sinFoto && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 hidden md:block"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--primario) 88%, transparent), transparent 72%)",
          }}
        />
      )}

      {sinFoto && (
        <div aria-hidden className="absolute top-16 right-[9%] -z-10 hidden lg:block">
          <Avatar src={tenant.logo} nombre="" tamano={240} decorativo />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 pt-10 pb-32 md:pt-24 md:pb-44 lg:pb-[17rem]">
        <div className="flex max-w-xl flex-col items-start gap-5">
          <Avatar src={tenant.logo} nombre={`Logo de ${tenant.nombre}`} tamano={56} prioridad />
          <h1 className="titulo-hero">{tenant.nombre}</h1>
          <p className="max-w-md text-lg text-pretty md:text-xl">{tenant.eslogan}</p>
          <ChipApertura horario={tenant.horario} />
          <Link
            href={enlaceReservar(tenant.slug)}
            className="bg-acento text-sobre-acento mt-2 hidden min-h-14 items-center justify-center gap-2.5 rounded-xl px-7 text-lg font-bold md:inline-flex"
          >
            <IconoCalendario width={22} height={22} />
            Reservar {tenant.textos.reserva}
          </Link>
        </div>
      </div>
    </header>
  );
}
