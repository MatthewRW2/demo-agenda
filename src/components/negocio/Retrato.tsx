import Image from "next/image";
import { iniciales } from "@/lib/texto";

interface Props {
  foto?: string;
  nombre: string;
  /** Tamaños que el navegador debe pedir; por defecto, los de la rejilla del equipo. */
  sizes?: string;
  /** Para miniaturas: radio y letras más chicos. */
  pequeno?: boolean;
}

/**
 * Foto de una persona del equipo en formato vertical 4:5. Es decorativa (el nombre va en texto al
 * lado). Si no hay foto, un campo del color primario con sus iniciales: nunca un hueco ni una imagen rota.
 */
export function Retrato({
  foto,
  nombre,
  sizes = "(min-width: 1024px) 14rem, (min-width: 640px) 28vw, 44vw",
  pequeno = false,
}: Props) {
  return (
    <div
      className={`bg-papel-2 relative aspect-[4/5] overflow-hidden ${pequeno ? "rounded-xl" : "rounded-2xl"}`}
    >
      {foto ? (
        <Image src={foto} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span
          aria-hidden
          className={`bg-primario text-sobre-primario font-display absolute inset-0 flex items-center justify-center font-extrabold ${pequeno ? "text-lg" : "text-5xl"}`}
        >
          {iniciales(nombre)}
        </span>
      )}
    </div>
  );
}
