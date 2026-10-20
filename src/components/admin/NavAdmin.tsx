import Link from "next/link";
import { BotonSalir } from "./BotonSalir";

export type SeccionAdmin = "agenda" | "recordatorios" | "metricas";

const SECCIONES: { id: SeccionAdmin; etiqueta: string; ruta: string }[] = [
  { id: "agenda", etiqueta: "Agenda", ruta: "" },
  { id: "recordatorios", etiqueta: "Recordatorios", ruta: "/recordatorios" },
  { id: "metricas", etiqueta: "Métricas", ruta: "/metricas" },
];

export function NavAdmin({
  slug,
  nombre,
  activa,
}: {
  slug: string;
  nombre: string;
  activa: SeccionAdmin;
}) {
  return (
    <header className="bg-primario text-sobre-primario">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pt-3">
        <p className="font-display text-lg font-bold">{nombre}</p>
        <div className="flex items-center">
          <Link
            href={`/${slug}`}
            className="min-h-12 px-3 py-3 text-sm font-semibold underline underline-offset-4"
          >
            Ver sitio
          </Link>
          <BotonSalir slug={slug} />
        </div>
      </div>
      <nav
        aria-label="Secciones del panel"
        className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2"
      >
        {SECCIONES.map((s) => (
          <Link
            key={s.id}
            href={`/${slug}/admin${s.ruta}`}
            aria-current={s.id === activa ? "page" : undefined}
            className={`min-h-12 shrink-0 rounded-t-xl px-4 py-3 font-semibold ${
              s.id === activa ? "bg-papel text-tinta" : "opacity-90"
            }`}
          >
            {s.etiqueta}
          </Link>
        ))}
      </nav>
    </header>
  );
}
