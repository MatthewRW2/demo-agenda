import { IconoInstagram, IconoUbicacion, IconoWhatsApp } from "@/components/iconos";
import { enlaceComoLlegar, enlaceInstagram, enlaceWhatsApp, urlMapaEmbebido } from "@/lib/enlaces";
import { agruparHorario } from "@/lib/horario";
import type { Tenant } from "@/lib/tenants/schema";

const BOTON_CONTACTO =
  "inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border-2 border-primario-texto px-5 font-semibold text-primario-texto";

/** Horario compacto, contacto y mapa: todo lo que hace falta para llegar o escribir. */
export function Visita({ tenant }: { tenant: Tenant }) {
  const grupos = agruparHorario(tenant.horario);

  return (
    <section aria-labelledby="visita" className="py-10 lg:py-14">
      <h2 id="visita" className="titulo-seccion text-tinta mb-8">
        Visítanos
      </h2>

      <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
        <div>
          <h3 className="font-display text-tinta mb-3 text-xl font-bold">Horario</h3>
          <dl className="border-linea border-y-2 border-dashed">
            {grupos.map((g) => (
              <div
                key={g.dias}
                className="border-linea flex justify-between gap-4 border-b-2 border-dashed py-3 last:border-b-0"
              >
                <dt className="text-tinta font-semibold">{g.dias}</dt>
                <dd className={`cifras text-right ${g.horas ? "text-tinta" : "text-tinta-suave"}`}>
                  {g.horas ?? "Cerrado"}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h3 className="font-display text-tinta mb-3 text-xl font-bold">Escríbenos</h3>
          <div className="flex flex-col gap-3">
            <a
              href={enlaceWhatsApp(
                tenant.whatsapp,
                `Hola, quiero más información sobre ${tenant.nombre}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={BOTON_CONTACTO}
            >
              <IconoWhatsApp />
              WhatsApp<span className="sr-only"> (abre en otra pestaña)</span>
            </a>
            {tenant.instagram && (
              <a
                href={enlaceInstagram(tenant.instagram)}
                target="_blank"
                rel="noopener noreferrer"
                className={BOTON_CONTACTO}
              >
                <IconoInstagram />@{tenant.instagram}
                <span className="sr-only"> en Instagram (abre en otra pestaña)</span>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h3 className="font-display text-tinta mb-3 text-xl font-bold">Dónde estamos</h3>
        <p className="text-tinta mb-4 flex items-start gap-2">
          <IconoUbicacion className="mt-0.5 shrink-0" />
          <span>{tenant.direccion}</span>
        </p>
        <iframe
          title={`Mapa de ${tenant.nombre}`}
          src={urlMapaEmbebido(tenant.direccion)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="bg-papel-2 h-72 w-full rounded-2xl lg:h-80"
        />
        <a
          href={enlaceComoLlegar(tenant.direccion)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primario-texto mt-3 inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
        >
          Cómo llegar<span className="sr-only"> (abre Google Maps en otra pestaña)</span>
        </a>
      </div>
    </section>
  );
}
