import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

/** Comprobación de salud: la app responde y la base de datos contesta. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true, db: "ok" });
  } catch {
    return Response.json({ ok: false, db: "error" }, { status: 503 });
  }
}
