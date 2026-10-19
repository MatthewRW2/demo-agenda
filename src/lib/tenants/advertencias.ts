import { contraste } from "../color";
import { DIAS, type Tenant } from "./schema";

/**
 * Avisos sobre un negocio que el esquema da por válido pero que casi seguro no se quiere publicar:
 * valores de relleno de la plantilla que se quedaron sin cambiar, colores que se leerían mal y
 * servicios que no caben en ningún día. No son errores: `npm run validar-tenants` los muestra y con
 * `--estricto` hace fallar el comando.
 */
export function advertenciasDeTenant(tenant: Tenant): string[] {
  const avisos: string[] = [];

  // --- valores de relleno de la plantilla ---
  const relleno: [boolean, string][] = [
    [tenant.nombre === "Nombre del Negocio", "nombre: sigue el de la plantilla"],
    [/una frase corta/i.test(tenant.eslogan), "eslogan: sigue el de la plantilla"],
    [/calle 00 #00-00/i.test(tenant.direccion), "direccion: sigue la de la plantilla"],
    [
      tenant.whatsapp === "573000000000",
      "whatsapp: sigue el número de la plantilla (573000000000)",
    ],
    [
      tenant.instagram === "usuario_de_instagram",
      "instagram: sigue el de la plantilla (o bórralo si no tiene)",
    ],
  ];
  for (const [aplica, mensaje] of relleno) if (aplica) avisos.push(mensaje);

  tenant.servicios.forEach((s, i) => {
    if (/^servicio \d+$/i.test(s.nombre))
      avisos.push(`servicios[${i}].nombre: "${s.nombre}" es de la plantilla`);
  });
  tenant.profesionales.forEach((p, i) => {
    if (/^profesional \d+$/i.test(p.nombre)) {
      avisos.push(`profesionales[${i}].nombre: "${p.nombre}" es de la plantilla`);
    }
  });

  // --- concordancia: los mensajes de la app están escritos en femenino ("tu cita quedó confirmada") ---
  if (/os?$/i.test(tenant.textos.reserva.trim())) {
    avisos.push(
      `textos.reserva ("${tenant.textos.reserva}") suena masculino y los mensajes de la app están en femenino ` +
        '("tu cita quedó confirmada"); prefiere cita, consulta, sesión o reserva.',
    );
  }

  // --- legibilidad: el color primario se usa como texto sobre fondo blanco (precios, enlaces) ---
  const ratio = contraste(tenant.colores.primario, "#ffffff");
  if (ratio < 4.5) {
    avisos.push(
      `colores.primario (${tenant.colores.primario}): contraste de ${ratio.toFixed(1)}:1 sobre blanco; ` +
        "el mínimo recomendado es 4,5:1 (precios y enlaces se leerán mal). Usa un tono más oscuro.",
    );
  }

  // --- servicios que no caben en ningún día de apertura ---
  const jornadaMasLarga = Math.max(
    0,
    ...DIAS.map((d) => {
      const h = tenant.horario[d];
      if (!h) return 0;
      const min = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
      return min(h[1]) - min(h[0]);
    }),
  );
  tenant.servicios.forEach((s, i) => {
    if (s.duracionMin > jornadaMasLarga) {
      avisos.push(
        `servicios[${i}] ("${s.nombre}"): dura ${s.duracionMin} min y la jornada más larga es de ${jornadaMasLarga} min; nadie podrá reservarlo`,
      );
    }
  });

  return avisos;
}
