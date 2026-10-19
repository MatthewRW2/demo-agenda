import { eq } from "drizzle-orm";
import { bookings, type Booking } from "@/db/schema";
import type { BaseDatos } from "./repositorio";

/** 32 bytes aleatorios en base64url = 43 caracteres. Se valida antes de tocar la base. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function esTokenValido(token: string): boolean {
  return TOKEN.test(token);
}

/** Busca una reserva por su enlace de gestión. `null` si el token no existe o no es de ese negocio. */
export async function buscarReservaPorToken(
  db: BaseDatos,
  slug: string,
  token: string,
): Promise<Booking | null> {
  if (!esTokenValido(token)) return null;
  const [fila] = await db.select().from(bookings).where(eq(bookings.manageToken, token)).limit(1);
  return fila && fila.tenantSlug === slug ? fila : null;
}
