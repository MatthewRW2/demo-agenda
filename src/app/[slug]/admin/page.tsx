import Link from "next/link";
import { notFound } from "next/navigation";
import { AgendaDia } from "@/components/admin/AgendaDia";
import { AgendaSemana } from "@/components/admin/AgendaSemana";
import { DetalleCita } from "@/components/admin/DetalleCita";
import { BotonRestablecerDemo } from "@/components/admin/BotonRestablecerDemo";
import { FormBloqueo, ListaBloqueos } from "@/components/admin/FormBloqueo";
import { FormCitaManual } from "@/components/admin/FormCitaManual";
import { NavAdmin } from "@/components/admin/NavAdmin";
import { PantallaAcceso } from "@/components/admin/PantallaAcceso";
import { getDb } from "@/db";
import { fechaValida, unico } from "@/lib/admin/parametros";
import { hoyEnBogota, limitesDelDia, lunesDeLaSemana, sumarDias } from "@/lib/disponibilidad";
import { aFechaHoraBogota, formatearFechaLarga } from "@/lib/fechas";
import { obtenerTenant } from "@/lib/tenants/obtener";
import { formatearHora } from "@/lib/texto";
import { comprobarAcceso } from "@/server/admin/acceso";
import { bloqueosEnRango, buscarReserva, reservasEnRango } from "@/server/admin/operaciones";

export const dynamic = "force-dynamic";

const ENLACE =
  "inline-flex min-h-12 items-center rounded-xl border-2 border-primario-texto px-4 font-semibold text-primario-texto";

export default async function PaginaAdmin({ params, searchParams }: PageProps<"/[slug]/admin">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  const acceso = await comprobarAcceso(slug);
  if (acceso !== "ok") return <PantallaAcceso tenant={tenant} acceso={acceso} />;

  const sp = await searchParams;
  const hoy = hoyEnBogota(new Date());
  const fecha = fechaValida(unico(sp.fecha)) ?? hoy;
  const vista = unico(sp.vista) === "semana" ? "semana" : "dia";
  const db = getDb();

  const lunes = lunesDeLaSemana(fecha);
  const rango =
    vista === "dia"
      ? limitesDelDia(fecha)
      : { desde: limitesDelDia(lunes).desde, hasta: limitesDelDia(sumarDias(lunes, 6)).hasta };
  const [reservas, bloqueos] = await Promise.all([
    reservasEnRango(db, slug, rango.desde, rango.hasta),
    bloqueosEnRango(db, slug, rango.desde, rango.hasta),
  ]);

  const idCita = unico(sp.cita);
  const seleccionada = idCita ? await buscarReserva(db, slug, idCita) : null;

  const paso = vista === "dia" ? 1 : 7;
  const base = (f: string, v = vista) => `/${slug}/admin?vista=${v}&fecha=${f}`;
  const nombreProfesional = new Map(tenant.profesionales.map((p) => [p.id, p.nombre]));
  const bloqueosDelDia = bloqueos.map((b) => {
    const i = aFechaHoraBogota(b.startsAt);
    const f = aFechaHoraBogota(b.endsAt);
    return {
      id: b.id,
      quien: b.professionalId
        ? (nombreProfesional.get(b.professionalId) ?? b.professionalId)
        : "Todo el local",
      rango: `${vista === "semana" ? `${formatearFechaLarga(i.fecha)}, ` : ""}${formatearHora(i.hora)} – ${formatearHora(f.hora)}`,
      motivo: b.reason,
    };
  });

  return (
    <>
      <NavAdmin slug={slug} nombre={tenant.nombre} activa="agenda" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-3">
          <h1 className="titulo-seccion text-tinta">
            {vista === "dia"
              ? formatearFechaLarga(fecha)
              : `Semana del ${formatearFechaLarga(lunes)}`}
          </h1>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Navegar en la agenda">
            <Link href={base(sumarDias(fecha, -paso))} className={ENLACE}>
              ← {vista === "dia" ? "Día anterior" : "Semana anterior"}
            </Link>
            <Link href={base(hoy)} className={ENLACE}>
              Hoy
            </Link>
            <Link href={base(sumarDias(fecha, paso))} className={ENLACE}>
              {vista === "dia" ? "Día siguiente" : "Semana siguiente"} →
            </Link>
            <Link
              href={base(fecha, vista === "dia" ? "semana" : "dia")}
              className={`${ENLACE} bg-papel-2`}
            >
              Ver {vista === "dia" ? "la semana" : "el día"}
            </Link>
          </div>
        </div>

        {seleccionada && (
          <DetalleCita tenant={tenant} reserva={seleccionada} hrefCerrar={base(fecha)} />
        )}

        {vista === "dia" ? (
          <AgendaDia
            tenant={tenant}
            fecha={fecha}
            reservas={reservas}
            bloqueos={bloqueos}
            seleccionada={seleccionada?.id}
          />
        ) : (
          <AgendaSemana tenant={tenant} lunes={lunes} reservas={reservas} />
        )}

        <ListaBloqueos slug={slug} bloqueos={bloqueosDelDia} />

        <div className="grid gap-4 lg:grid-cols-2">
          <FormCitaManual
            slug={slug}
            servicios={tenant.servicios.map((s) => ({ id: s.id, nombre: s.nombre }))}
            profesionales={tenant.profesionales.map((p) => ({ id: p.id, nombre: p.nombre }))}
            fechaInicial={vista === "dia" ? fecha : hoy}
            textoProfesional={tenant.textos.profesional}
            textoReserva={tenant.textos.reserva}
          />
          <FormBloqueo
            slug={slug}
            profesionales={tenant.profesionales.map((p) => ({ id: p.id, nombre: p.nombre }))}
            fechaInicial={vista === "dia" ? fecha : hoy}
          />
        </div>

        {tenant.demo && <BotonRestablecerDemo slug={slug} />}
      </main>
    </>
  );
}
