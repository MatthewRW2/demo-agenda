import { createHash, timingSafeEqual } from "node:crypto";

/**
 * ¿La petición trae `Authorization: Bearer <CRON_SECRET>`? Vercel envía ese encabezado solo cuando
 * la variable está definida. Sin secreto configurado nunca se autoriza (falla cerrada).
 */
export function autorizadoCron(authorization: string | null, secreto: string | undefined): boolean {
  if (!secreto || !authorization) return false;
  const esperado = `Bearer ${secreto}`;
  const a = createHash("sha256").update(authorization).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}
