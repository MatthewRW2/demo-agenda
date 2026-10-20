import { resenasParaMostrar } from "@/lib/resenas";
import type { Tenant } from "@/lib/tenants/schema";

function Estrellas({ n }: { n: number }) {
  return (
    <span role="img" aria-label={`${n} de 5 estrellas`} className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          aria-hidden
          className={i < n ? "text-tinta" : "text-linea"}
          fill="currentColor"
        >
          <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Reseñas. Las reales vienen del JSON del negocio; en una demo sin ellas se muestran unas de ejemplo
 * con el rótulo bien visible; en un negocio real sin reseñas la sección no existe.
 */
export function Resenas({ tenant }: { tenant: Tenant }) {
  const datos = resenasParaMostrar(tenant);
  if (!datos) return null;
  const [principal, ...resto] = datos.resenas;

  return (
    <section aria-labelledby="resenas" className="py-10 lg:py-14">
      <h2 id="resenas" className="titulo-seccion text-tinta">
        {datos.esEjemplo ? "Reseñas de ejemplo" : "Reseñas"}
      </h2>
      {datos.esEjemplo && (
        <p className="text-tinta-suave mt-2 mb-6 max-w-md text-base">
          Así se verían las opiniones de tus clientes. Estas son inventadas, no son de personas
          reales.
        </p>
      )}

      <div className={`grid gap-x-10 gap-y-8 md:grid-cols-2 ${datos.esEjemplo ? "" : "mt-6"}`}>
        <figure className="md:col-span-2">
          <Estrellas n={principal.estrellas} />
          <blockquote className="font-display text-tinta mt-3 text-2xl leading-snug font-bold text-balance md:text-3xl">
            “{principal.texto}”
          </blockquote>
          <figcaption className="text-tinta-suave mt-3 text-sm">
            {principal.autor}
            {principal.fuente ? ` · ${principal.fuente}` : ""}
          </figcaption>
        </figure>
        {resto.map((r) => (
          <figure key={r.autor + r.texto} className="border-linea border-t-2 border-dashed pt-5">
            <Estrellas n={r.estrellas} />
            <blockquote className="text-tinta mt-2 text-lg text-pretty">“{r.texto}”</blockquote>
            <figcaption className="text-tinta-suave mt-2 text-sm">
              {r.autor}
              {r.fuente ? ` · ${r.fuente}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
