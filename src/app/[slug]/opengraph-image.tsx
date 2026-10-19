import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { colorTextoSobre } from "@/lib/color";
import { listarSlugs } from "@/lib/tenants/cargar";
import { obtenerTenant } from "@/lib/tenants/obtener";

// Las vistas previas se generan al compilar, una por negocio.
export function generateStaticParams() {
  return listarSlugs().map((slug) => ({ slug }));
}

export const alt = "Vista previa del negocio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIPOS: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/** Logo del negocio como data URI (la imagen se genera sin red). Devuelve null si no se puede leer. */
async function logoComoDataUri(ruta: string): Promise<string | null> {
  const publico = path.join(process.cwd(), "public");
  const archivo = path.join(publico, ruta);
  const tipo = TIPOS[path.extname(archivo).toLowerCase()];
  if (!tipo || !archivo.startsWith(publico + path.sep)) return null;
  try {
    return `data:${tipo};base64,${(await readFile(archivo)).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = obtenerTenant(slug);
  if (!tenant) return new Response("No encontrado", { status: 404 });

  const { primario, acento } = tenant.colores;
  const texto = colorTextoSobre(primario);
  const logo = await logoComoDataUri(tenant.logo);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: primario,
        color: texto,
        padding: 72,
        borderBottom: `24px solid ${acento}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={200} height={200} alt="" style={{ borderRadius: 100 }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>{tenant.nombre}</div>
          <div style={{ fontSize: 36, opacity: 0.9, lineHeight: 1.3 }}>{tenant.eslogan}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            background: acento,
            color: colorTextoSobre(acento),
            fontSize: 40,
            fontWeight: 700,
            padding: "20px 40px",
            borderRadius: 20,
          }}
        >
          Reserva tu {tenant.textos.reserva} en línea
        </div>
        <div style={{ fontSize: 30, opacity: 0.85 }}>{tenant.direccion}</div>
      </div>
    </div>,
    { ...size },
  );
}
