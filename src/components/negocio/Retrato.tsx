import Image from "next/image";
import { iniciales } from "@/lib/texto";

/**
 * Foto de una persona del equipo en formato vertical 4:5. Es decorativa (el nombre va en texto al
 * lado). Si no hay foto, un campo del color primario con sus iniciales: nunca un hueco ni una imagen rota.
 */
export function Retrato({ foto, nombre }: { foto?: string; nombre: string }) {
  return (
    <div className="bg-papel-2 relative aspect-[4/5] overflow-hidden rounded-2xl">
      {foto ? (
        <Image
          src={foto}
          alt=""
          fill
          sizes="(min-width: 1024px) 14rem, (min-width: 640px) 28vw, 44vw"
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="bg-primario text-sobre-primario font-display absolute inset-0 flex items-center justify-center text-5xl font-extrabold"
        >
          {iniciales(nombre)}
        </span>
      )}
    </div>
  );
}
