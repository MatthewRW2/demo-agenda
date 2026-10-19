import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { blocks, bookings } from "@/db/schema";
import { diaDeSemana, hoyEnBogota, limitesDelDia, sumarDias } from "@/lib/disponibilidad";
import { aFechaHoraBogota } from "@/lib/fechas";
import { validarTenant } from "@/lib/tenants/cargar";
import { normalizarCelular } from "@/lib/validacion";
import { tenantDePrueba } from "@/test/tenantDePrueba";
import type { Tenant } from "@/lib/tenants/schema";
import { autorizadoCron } from "./cron";
import { generarDatosDemo, type DatosDemo } from "./datos";
import { sembrarDemo, vaciarDemo } from "./sembrar";

const bogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const MIERCOLES = bogota("2030-03-06", "11:00");

function contador() {
  let n = 0;
  return () => `token-${++n}`.padEnd(43, "x");
}

/** Reglas que todo juego de datos de demo debe cumplir. */
function verificar(tenant: Tenant, ahora: Date, d: DatosDemo, cantidad = 60) {
  const hoy = hoyEnBogota(ahora);
  const desde = limitesDelDia(sumarDias(hoy, -14)).desde;
  const hasta = limitesDelDia(sumarDias(hoy, 13)).hasta;

  expect(d.reservas).toHaveLength(cantidad);

  for (const r of d.reservas) {
    const servicio = tenant.servicios.find((s) => s.id === r.serviceId)!;
    const prof = tenant.profesionales.find((p) => p.id === r.professionalId)!;
    expect(servicio, "servicio existe").toBeDefined();
    expect(prof?.servicios, "el profesional hace ese servicio").toContain(servicio.id);
    expect(r.tenantSlug).toBe(tenant.slug);

    // dentro de la ventana, en horario y en la rejilla
    expect(r.startsAt >= desde && r.startsAt < hasta, "dentro de la ventana de 4 semanas").toBe(
      true,
    );
    const { fecha, hora } = aFechaHoraBogota(r.startsAt);
    const rango = tenant.horario[diaDeSemana(fecha)];
    expect(rango, `el local abre el ${fecha}`).not.toBeNull();
    expect(minutos(hora)).toBeGreaterThanOrEqual(minutos(rango![0]));
    expect((minutos(hora) - minutos(rango![0])) % tenant.intervaloMin, "en la rejilla").toBe(0);
    expect(r.endsAt.getTime() - r.startsAt.getTime()).toBe(servicio.duracionMin * 60_000);
    expect(
      minutos(aFechaHoraBogota(r.endsAt).hora),
      "termina antes del cierre",
    ).toBeLessThanOrEqual(minutos(rango![1]));

    // estados coherentes con la fecha
    if (r.endsAt! <= ahora) expect(["completada", "no_asistio", "cancelada"]).toContain(r.status);
    else if (r.startsAt <= ahora) expect(r.status).toBe("confirmada");
    else expect(["confirmada", "cancelada"]).toContain(r.status);

    // datos del cliente con apariencia ficticia pero válida
    expect(r.customerName!.length).toBeGreaterThan(3);
    if (r.customerPhone) expect(normalizarCelular(r.customerPhone)).toBe(r.customerPhone);
    if (r.customerEmail) expect(r.customerEmail).toMatch(/@correo\.example$/);
    expect(r.createdAt!.getTime()).toBeLessThanOrEqual(ahora.getTime());
    expect(r.createdAt!.getTime()).toBeLessThanOrEqual(r.startsAt.getTime());
    if (r.reminderSentAt) expect(["confirmada", "completada", "no_asistio"]).toContain(r.status);
  }

  // sin traslapes entre citas activas de un mismo profesional (lo exigiría la base de datos)
  const activas = d.reservas.filter((r) => r.status !== "cancelada");
  for (let i = 0; i < activas.length; i++) {
    for (let j = i + 1; j < activas.length; j++) {
      const a = activas[i];
      const b = activas[j];
      if (a.professionalId !== b.professionalId) continue;
      expect(
        a.startsAt < b.endsAt! && b.startsAt < a.endsAt!,
        `traslape de ${a.professionalId}`,
      ).toBe(false);
    }
  }

  // bloqueos: futuros, válidos y sin citas encima
  for (const b of d.bloqueos) {
    expect(fechaDe(b.startsAt) > hoy, "bloqueo en un día futuro").toBe(true);
    expect(b.endsAt > b.startsAt).toBe(true);
    if (b.professionalId) expect(tenant.profesionales.map((p) => p.id)).toContain(b.professionalId);
    for (const r of d.reservas) {
      if (b.professionalId && r.professionalId !== b.professionalId) continue;
      expect(r.startsAt < b.endsAt && b.startsAt < r.endsAt!, "cita sobre un bloqueo").toBe(false);
    }
  }

  expect(new Set(d.reservas.map((r) => r.manageToken)).size, "tokens únicos").toBe(
    d.reservas.length,
  );
}

function fechaDe(instante: Date) {
  return aFechaHoraBogota(instante).fecha;
}

describe("generarDatosDemo", () => {
  it("crea 60 citas coherentes en la ventana de 4 semanas", () => {
    verificar(tenantDePrueba, MIERCOLES, generarDatosDemo(tenantDePrueba, MIERCOLES));
  });

  it("cumple las reglas cualquier día de la semana y a cualquier hora del día", () => {
    for (let dia = 0; dia < 7; dia++) {
      for (const hora of ["00:30", "09:00", "14:20", "19:40", "23:50"]) {
        const ahora = bogota(sumarDias("2030-03-04", dia), hora);
        const datos = generarDatosDemo(tenantDePrueba, ahora);
        expect(
          () => verificar(tenantDePrueba, ahora, datos),
          `${sumarDias("2030-03-04", dia)} ${hora}`,
        ).not.toThrow();
      }
    }
  });

  it("incluye todos los estados, citas web y del panel, y bloqueos para que se vea viva", () => {
    const { reservas, bloqueos } = generarDatosDemo(tenantDePrueba, MIERCOLES);
    for (const estado of ["confirmada", "completada", "no_asistio", "cancelada"]) {
      expect(
        reservas.some((r) => r.status === estado),
        estado,
      ).toBe(true);
    }
    expect(reservas.some((r) => r.source === "admin")).toBe(true);
    expect(reservas.some((r) => r.source === "web")).toBe(true);
    expect(reservas.some((r) => r.customerPhone === "")).toBe(true);
    expect(bloqueos.length).toBeGreaterThanOrEqual(2);
    expect(reservas.filter((r) => r.status === "completada").length).toBeGreaterThan(
      reservas.filter((r) => r.status === "no_asistio").length,
    );
  });

  it("la mayoría de lo pasado salió bien: pocas inasistencias y cancelaciones", () => {
    const pasadas = generarDatosDemo(tenantDePrueba, MIERCOLES).reservas.filter(
      (r) => r.endsAt! <= MIERCOLES,
    );
    const completadas = pasadas.filter((r) => r.status === "completada").length;
    expect(completadas / pasadas.length).toBeGreaterThan(0.55);
  });

  it("la agenda de hoy nunca queda vacía si el local abre (con citas ya atendidas y por venir)", () => {
    const hoy = hoyEnBogota(MIERCOLES);
    const deHoy = generarDatosDemo(tenantDePrueba, MIERCOLES).reservas.filter(
      (r) => fechaDe(r.startsAt) === hoy,
    );
    expect(deHoy.length).toBeGreaterThanOrEqual(5);
    expect(deHoy.some((r) => r.endsAt! <= MIERCOLES)).toBe(true);
    expect(deHoy.some((r) => r.startsAt > MIERCOLES)).toBe(true);
  });

  it("deja varias citas confirmadas mañana para el panel de recordatorios", () => {
    const manana = sumarDias(hoyEnBogota(MIERCOLES), 1);
    const deManana = generarDatosDemo(tenantDePrueba, MIERCOLES).reservas.filter(
      (r) => fechaDe(r.startsAt) === manana && r.status === "confirmada",
    );
    expect(deManana.length).toBeGreaterThanOrEqual(4);
    expect(deManana.some((r) => r.customerPhone)).toBe(true);
  });

  it("si mañana el local está cerrado (sábado -> domingo) no inventa citas ese día", () => {
    const sabado = bogota("2030-03-09", "10:00");
    const { reservas } = generarDatosDemo(tenantDePrueba, sabado);
    expect(reservas.some((r) => fechaDe(r.startsAt) === "2030-03-10")).toBe(false);
    verificar(tenantDePrueba, sabado, { reservas, bloqueos: [] }, 60);
  });

  it("es reproducible: mismos datos, mismo resultado; otro día, otro resultado", () => {
    const sinToken = (d: DatosDemo) =>
      d.reservas.map(({ manageToken: _t, ...resto }) => {
        void _t;
        return resto;
      });
    const a = generarDatosDemo(tenantDePrueba, MIERCOLES, { generarToken: contador() });
    const b = generarDatosDemo(tenantDePrueba, MIERCOLES, { generarToken: contador() });
    expect(sinToken(a)).toEqual(sinToken(b));
    const otroDia = generarDatosDemo(tenantDePrueba, bogota("2030-03-07", "11:00"), {
      generarToken: contador(),
    });
    expect(sinToken(otroDia)).not.toEqual(sinToken(a));
    expect(
      generarDatosDemo(tenantDePrueba, MIERCOLES, { semilla: "otra" }).reservas.map(
        (r) => r.startsAt,
      ),
    ).not.toEqual(a.reservas.map((r) => r.startsAt));
  });

  it("los tokens por defecto son aleatorios y de 43 caracteres", () => {
    const { reservas } = generarDatosDemo(tenantDePrueba, MIERCOLES);
    expect(reservas.every((r) => /^[A-Za-z0-9_-]{43}$/.test(r.manageToken))).toBe(true);
  });

  it("los números de celular son del bloque ficticio 300 0000 xxx", () => {
    const { reservas } = generarDatosDemo(tenantDePrueba, MIERCOLES);
    for (const r of reservas)
      if (r.customerPhone) expect(r.customerPhone).toMatch(/^3000000\d{3}$/);
  });

  it("respeta la cantidad pedida", () => {
    expect(generarDatosDemo(tenantDePrueba, MIERCOLES, { cantidad: 12 }).reservas).toHaveLength(12);
  });

  it("funciona con la plantilla (un solo profesional) y con un consultorio distinto", () => {
    const plantilla = validarTenant(
      JSON.parse(readFileSync(path.join(process.cwd(), "tenants", "_plantilla.json"), "utf8")),
      "_plantilla.json",
    );
    verificar(plantilla, MIERCOLES, generarDatosDemo(plantilla, MIERCOLES), 60);

    const consultorio: Tenant = {
      ...tenantDePrueba,
      slug: "clinica",
      intervaloMin: 30,
      textos: { profesional: "odontólogo", reserva: "cita" },
      servicios: [
        { id: "limpieza", nombre: "Limpieza", duracionMin: 60, precio: 80000 },
        { id: "control", nombre: "Control", duracionMin: 30, precio: 40000 },
      ],
      profesionales: [
        { id: "dra-ana", nombre: "Dra. Ana", servicios: ["limpieza", "control"] },
        { id: "dr-pablo", nombre: "Dr. Pablo", servicios: ["control"] },
      ],
    };
    verificar(consultorio, MIERCOLES, generarDatosDemo(consultorio, MIERCOLES), 60);
  });
});

describe("autorizadoCron", () => {
  it("solo acepta 'Bearer <secreto>' exacto", () => {
    expect(autorizadoCron("Bearer secreto123", "secreto123")).toBe(true);
    expect(autorizadoCron("Bearer otro", "secreto123")).toBe(false);
    expect(autorizadoCron("secreto123", "secreto123")).toBe(false);
    expect(autorizadoCron("bearer secreto123", "secreto123")).toBe(false);
    expect(autorizadoCron("Bearer secreto123 ", "secreto123")).toBe(false);
    expect(autorizadoCron(null, "secreto123")).toBe(false);
    expect(autorizadoCron("", "secreto123")).toBe(false);
  });

  it("sin secreto configurado nada se autoriza (falla cerrada)", () => {
    expect(autorizadoCron("Bearer ", "")).toBe(false);
    expect(autorizadoCron("Bearer undefined", undefined)).toBe(false);
    expect(autorizadoCron("Bearer ", undefined)).toBe(false);
  });
});

describe("sembrarDemo contra Postgres real", () => {
  let cliente: PGlite;
  let db: ReturnType<typeof drizzle>;
  const base = () => db as never;

  beforeAll(async () => {
    cliente = new PGlite({ extensions: { btree_gist } });
    db = drizzle(cliente);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });
  afterAll(async () => {
    await cliente.close();
  });

  const contar = async (slug: string) => ({
    reservas: (await db.select().from(bookings).where(eq(bookings.tenantSlug, slug))).length,
    bloqueos: (await db.select().from(blocks).where(eq(blocks.tenantSlug, slug))).length,
  });

  it("inserta todo sin que la restricción anti-traslape rechace nada, y la repetición lo reemplaza", async () => {
    const primera = await sembrarDemo(base(), tenantDePrueba, MIERCOLES);
    expect(primera.reservas).toBe(60);
    expect(await contar("prueba")).toEqual(primera);

    const segunda = await sembrarDemo(base(), tenantDePrueba, bogota("2030-03-07", "10:00"));
    expect(segunda.reservas).toBe(60);
    expect(await contar("prueba")).toEqual(segunda); // reemplazó, no acumuló
  });

  it("solo borra los datos del negocio que se siembra", async () => {
    const otro = { ...tenantDePrueba, slug: "otro-demo" };
    await sembrarDemo(base(), otro, MIERCOLES);
    const antes = await contar("otro-demo");
    await sembrarDemo(base(), tenantDePrueba, MIERCOLES);
    expect(await contar("otro-demo")).toEqual(antes);
  });

  it("vaciarDemo borra solo las citas y bloqueos de ese negocio y cuenta lo borrado", async () => {
    const otro = { ...tenantDePrueba, slug: "otro-vaciar" };
    await sembrarDemo(base(), otro, MIERCOLES);
    const sembrado = await sembrarDemo(base(), tenantDePrueba, MIERCOLES);
    const intacto = await contar("otro-vaciar");

    expect(await vaciarDemo(base(), tenantDePrueba)).toEqual(sembrado);
    expect(await contar("prueba")).toEqual({ reservas: 0, bloqueos: 0 });
    expect(await contar("otro-vaciar")).toEqual(intacto);
    // vaciar algo ya vacío no falla
    expect(await vaciarDemo(base(), tenantDePrueba)).toEqual({ reservas: 0, bloqueos: 0 });
  });

  it("vaciarDemo también se niega con un negocio real y no borra nada", async () => {
    await sembrarDemo(base(), tenantDePrueba, MIERCOLES);
    const antes = await contar("prueba");
    await expect(vaciarDemo(base(), { ...tenantDePrueba, demo: false })).rejects.toThrow(
      /no es un negocio de demostración/,
    );
    expect(await contar("prueba")).toEqual(antes);
  });

  it("se niega a tocar un negocio que no es de demostración y no borra nada", async () => {
    await sembrarDemo(base(), tenantDePrueba, MIERCOLES);
    const antes = await contar("prueba");
    await expect(
      sembrarDemo(base(), { ...tenantDePrueba, demo: false }, MIERCOLES),
    ).rejects.toThrow(/no es un negocio de demostración/);
    expect(await contar("prueba")).toEqual(antes);
  });
});
