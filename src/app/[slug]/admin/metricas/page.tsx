import Link from "next/link";
import { notFound } from "next/navigation";
import { NavAdmin } from "@/components/admin/NavAdmin";
import { PantallaAcceso } from "@/components/admin/PantallaAcceso";
import { getDb } from "@/db";
import { calcularMetricas } from "@/lib/admin/metricas";
import { fechaValida, unico } from "@/lib/admin/parametros";
import { hoyEnBogota, limitesDelDia, lunesDeLaSemana, sumarDias } from "@/lib/disponibilidad";
import { formatearFechaLarga } from "@/lib/fechas";
import { formatearCOP } from "@/lib/moneda";
import { obtenerTenant } from "@/lib/tenants/obtener";
import { formatearHora } from "@/lib/texto";
import { comprobarAcceso } from "@/server/admin/acceso";
import { reservasEnRango } from "@/server/admin/operaciones";

export const dynamic = "force-dynamic";

const ENLACE =
  "inline-flex min-h-12 items-center rounded-xl border-2 border-primario-texto px-4 font-semibold text-primario-texto";

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="border-linea rounded-xl border p-4">
      <dt className="text-tinta-suave text-sm">{titulo}</dt>
      <dd className="mt-1 text-2xl font-bold">{valor}</dd>
      {detalle && <dd className="text-tinta-suave mt-1 text-sm">{detalle}</dd>}
    </div>
  );
}

export default async function PaginaMetricas({
  params,
  searchParams,
}: PageProps<"/[slug]/admin/metricas">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  const acceso = await comprobarAcceso(slug);
  if (acceso !== "ok") return <PantallaAcceso tenant={tenant} acceso={acceso} />;

  const sp = await searchParams;
  const hoy = hoyEnBogota(new Date());
  const lunes = lunesDeLaSemana(fechaValida(unico(sp.fecha)) ?? hoy);
  const domingo = sumarDias(lunes, 6);
  const reservas = await reservasEnRango(
    getDb(),
    slug,
    limitesDelDia(lunes).desde,
    limitesDelDia(domingo).hasta,
  );
  // Una cita que cruza la medianoche pertenece al día en que empieza: se descartan las que empezaron antes del lunes.
  const delaSemana = reservas.filter((r) => r.startsAt >= limitesDelDia(lunes).desde);
  const m = calcularMetricas(tenant, delaSemana);
  const href = (f: string) => `/${slug}/admin/metricas?fecha=${f}`;

  return (
    <>
      <NavAdmin slug={slug} nombre={tenant.nombre} activa="metricas" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <div>
          <h1 className="titulo-seccion text-tinta">Métricas de la semana</h1>
          <p className="text-tinta-suave">
            Del {formatearFechaLarga(lunes)} al {formatearFechaLarga(domingo)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Cambiar de semana">
          <Link href={href(sumarDias(lunes, -7))} className={ENLACE}>
            ← Semana anterior
          </Link>
          <Link href={href(hoy)} className={ENLACE}>
            Esta semana
          </Link>
          <Link href={href(sumarDias(lunes, 7))} className={ENLACE}>
            Semana siguiente →
          </Link>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <Tarjeta
            titulo="Citas"
            valor={String(m.citas)}
            detalle={
              m.canceladas === 0
                ? "Sin canceladas"
                : `${m.canceladas} cancelada${m.canceladas === 1 ? " no cuenta" : "s no cuentan"}`
            }
          />
          <Tarjeta
            titulo="Inasistencias"
            valor={
              m.porcentajeInasistencias === null
                ? "—"
                : `${String(m.porcentajeInasistencias).replace(".", ",")} %`
            }
            detalle={
              m.porcentajeInasistencias === null
                ? "Aún no hay citas completadas ni inasistencias"
                : `${m.inasistencias} de ${m.completadas + m.inasistencias} ${m.completadas + m.inasistencias === 1 ? "cita resuelta" : "citas resueltas"}`
            }
          />
          <Tarjeta
            titulo="Ingresos estimados"
            valor={formatearCOP(m.ingresosEstimados)}
            detalle="Citas confirmadas y completadas, a precio de lista"
          />
          <Tarjeta
            titulo="Servicio más pedido"
            valor={m.servicioMasPedido?.nombre ?? "—"}
            detalle={
              m.servicioMasPedido
                ? `${m.servicioMasPedido.cantidad} cita${m.servicioMasPedido.cantidad === 1 ? "" : "s"}`
                : undefined
            }
          />
          <Tarjeta
            titulo="Hora más ocupada"
            valor={
              m.horaMasOcupada
                ? `${formatearHora(`${String(m.horaMasOcupada.hora).padStart(2, "0")}:00`)} – ${formatearHora(`${String((m.horaMasOcupada.hora + 1) % 24).padStart(2, "0")}:00`)}`
                : "—"
            }
            detalle={
              m.horaMasOcupada
                ? `${m.horaMasOcupada.cantidad} cita${m.horaMasOcupada.cantidad === 1 ? "" : "s"} empiezan en esa franja`
                : undefined
            }
          />
        </dl>
      </main>
    </>
  );
}
