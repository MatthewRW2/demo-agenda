import type { Acceso } from "@/server/admin/acceso";
import { contrasenaDelPanel } from "@/server/admin/acceso";
import type { Tenant } from "@/lib/tenants/schema";
import { FormLogin } from "./FormLogin";

/** Lo que ve quien entra al panel sin sesión: el formulario, o un aviso si el panel no está configurado. */
export function PantallaAcceso({
  tenant,
  acceso,
}: {
  tenant: Tenant;
  acceso: Exclude<Acceso, "ok">;
}) {
  if (acceso === "sin_config") {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-4 py-10">
        <h1 className="titulo-seccion text-tinta">Panel no disponible</h1>
        <p className="text-tinta-suave">
          El panel de {tenant.nombre} todavía no está configurado. Quien administra la aplicación
          debe definir la variable <code>ADMIN_PASSWORD</code>.
        </p>
      </main>
    );
  }
  return (
    <FormLogin
      slug={tenant.slug}
      nombreNegocio={tenant.nombre}
      // Solo los negocios marcados como demo muestran la contraseña en pantalla.
      contrasenaDemo={tenant.demo ? contrasenaDelPanel() : undefined}
    />
  );
}
