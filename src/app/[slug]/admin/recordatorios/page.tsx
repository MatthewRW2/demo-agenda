import { notFound } from "next/navigation";
import { FilaRecordatorio } from "@/components/admin/FilaRecordatorio";
import { NavAdmin } from "@/components/admin/NavAdmin";
import { PantallaAcceso } from "@/components/admin/PantallaAcceso";
import { getDb } from "@/db";
import { hoyEnBogota, sumarDias } from "@/lib/disponibilidad";
import { urlBase } from "@/lib/enlaces";
import { aFechaHoraBogota, formatearFechaLarga } from "@/lib/fechas";
import { enlaceRecordatorio } from "@/lib/reserva";
import { obtenerTenant } from "@/lib/tenants/obtener";
import { formatearHora } from "@/lib/texto";
import { comprobarAcceso } from "@/server/admin/acceso";
import { citasConfirmadasDelDia } from "@/server/admin/operaciones";

export const dynamic = "force-dynamic";

export default async function PaginaRecordatorios({
  params,
}: PageProps<"/[slug]/admin/recordatorios">) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) notFound();

  const acceso = await comprobarAcceso(slug);
  if (acceso !== "ok") return <PantallaAcceso tenant={tenant} acceso={acceso} />;

  const manana = sumarDias(hoyEnBogota(new Date()), 1);
  const citas = await citasConfirmadasDelDia(getDb(), slug, manana);
  const servicios = new Map(tenant.servicios.map((s) => [s.id, s.nombre]));
  const profesionales = new Map(tenant.profesionales.map((p) => [p.id, p.nombre]));
  const pendientes = citas.filter((c) => !c.reminderSentAt && c.customerPhone).length;

  return (
    <>
      <NavAdmin slug={slug} nombre={tenant.nombre} activa="recordatorios" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Recordatorios de mañana</h1>
          <p className="text-neutral-700">
            {formatearFechaLarga(manana)} · {citas.length} cita{citas.length === 1 ? "" : "s"}
            {citas.length > 0 && `, ${pendientes} por recordar`}
          </p>
        </div>

        {citas.length === 0 ? (
          <p className="rounded-xl bg-neutral-100 p-4">
            No hay citas confirmadas para mañana, así que no hay nada que recordar.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {citas.map((c) => {
              const hora = formatearHora(aFechaHoraBogota(c.startsAt).hora);
              return (
                <FilaRecordatorio
                  key={c.id}
                  slug={slug}
                  id={c.id}
                  hora={hora}
                  cliente={c.customerName}
                  detalle={`${servicios.get(c.serviceId) ?? c.serviceId} · ${profesionales.get(c.professionalId) ?? c.professionalId}`}
                  href={enlaceRecordatorio({
                    tenant,
                    nombreCliente: c.customerName,
                    celular: c.customerPhone,
                    hora,
                    enlaceGestion: `${urlBase()}/${slug}/cita/${c.manageToken}`,
                  })}
                  enviadoEn={c.reminderSentAt?.toISOString() ?? null}
                />
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
