import Image from "next/image";

interface Props {
  src?: string;
  nombre: string;
  tamano: number;
  prioridad?: boolean;
  /** Si la persona ya está nombrada en texto al lado, la imagen es decorativa (alt vacío). */
  decorativo?: boolean;
  className?: string;
}

/** Imagen redonda de logo o persona. Los SVG no pasan por el optimizador de imágenes. */
export function Avatar({ src, nombre, tamano, prioridad, decorativo, className = "" }: Props) {
  if (!src) {
    return (
      <span
        aria-hidden
        style={{ width: tamano, height: tamano }}
        className={`bg-primario text-sobre-primario inline-flex items-center justify-center rounded-full font-bold ${className}`}
      >
        {nombre.charAt(0).toLocaleUpperCase("es-CO")}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={decorativo ? "" : nombre}
      width={tamano}
      height={tamano}
      priority={prioridad}
      unoptimized={src.endsWith(".svg")}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
