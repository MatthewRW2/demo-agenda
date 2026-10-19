import { IconoInstagram, IconoWhatsApp } from "@/components/iconos";
import { enlaceInstagram, enlaceWhatsApp } from "@/lib/enlaces";
import type { Tenant } from "@/lib/tenants/schema";

const BOTON =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primario px-5 font-semibold text-primario";

export function Contacto({ tenant }: { tenant: Tenant }) {
  return (
    <section aria-labelledby="contacto" className="px-4 py-8">
      <h2 id="contacto" className="mb-4 text-2xl font-bold">
        Escríbenos
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={enlaceWhatsApp(
            tenant.whatsapp,
            `Hola, quiero más información sobre ${tenant.nombre}.`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className={BOTON}
        >
          <IconoWhatsApp />
          WhatsApp<span className="sr-only"> (abre en otra pestaña)</span>
        </a>
        {tenant.instagram && (
          <a
            href={enlaceInstagram(tenant.instagram)}
            target="_blank"
            rel="noopener noreferrer"
            className={BOTON}
          >
            <IconoInstagram />@{tenant.instagram}
            <span className="sr-only"> en Instagram (abre en otra pestaña)</span>
          </a>
        )}
      </div>
    </section>
  );
}
