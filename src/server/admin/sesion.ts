import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** La sesión del panel dura 7 días y se invalida sola si cambia ADMIN_PASSWORD. */
export const DURACION_SESION_S = 7 * 24 * 60 * 60;

export function nombreCookie(slug: string): string {
  return `admin_${slug}`;
}

/** La clave de firma se deriva de la contraseña: no hace falta otra variable de entorno. */
function clave(password: string): Buffer {
  return createHash("sha256").update(`admin-session:${password}`).digest();
}

function firmar(carga: string, password: string): string {
  return createHmac("sha256", clave(password)).update(carga).digest("base64url");
}

function iguales(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Compara la contraseña escrita con la esperada en tiempo constante. Una contraseña vacía nunca es válida. */
export function contrasenaCorrecta(entrada: string, esperada: string): boolean {
  if (!esperada) return false;
  return iguales(entrada, esperada);
}

/** Token de sesión para un negocio: `<carga>.<firma>`, con el slug y la expiración dentro de la carga. */
export function crearTokenSesion(slug: string, password: string, ahora: Date): string {
  const expira = Math.floor(ahora.getTime() / 1000) + DURACION_SESION_S;
  const carga = Buffer.from(JSON.stringify({ s: slug, e: expira })).toString("base64url");
  return `${carga}.${firmar(carga, password)}`;
}

/** ¿El token es auténtico, de este negocio y no ha vencido? */
export function verificarTokenSesion(
  token: string | undefined,
  slug: string,
  password: string,
  ahora: Date,
): boolean {
  if (!token || !password) return false;
  const [carga, firma, sobrante] = token.split(".");
  if (!carga || !firma || sobrante !== undefined) return false;
  if (!iguales(firma, firmar(carga, password))) return false;
  try {
    const datos = JSON.parse(Buffer.from(carga, "base64url").toString("utf8")) as {
      s?: unknown;
      e?: unknown;
    };
    return datos.s === slug && typeof datos.e === "number" && datos.e > ahora.getTime() / 1000;
  } catch {
    return false;
  }
}
