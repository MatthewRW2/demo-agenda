import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export { schema };

function crearDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y pega la cadena de conexión de Neon.",
    );
  }
  return drizzle(neon(url), { schema });
}

let instancia: ReturnType<typeof crearDb> | undefined;

/** Conexión a la base de datos, creada la primera vez que se usa (así `next build` no la exige). */
export function getDb() {
  instancia ??= crearDb();
  return instancia;
}
