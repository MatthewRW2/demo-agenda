import { randomBytes } from "node:crypto";
import type { NuevaBooking, NuevoBlock } from "@/db/schema";
import { diaDeSemana, hoyEnBogota, instanteBogota, sumarDias } from "@/lib/disponibilidad";
import type { Servicio, Tenant } from "@/lib/tenants/schema";

/** Datos ficticios para que el panel se vea vivo: citas de las últimas 2 semanas y las próximas 2. */

const NOMBRES = [
  "Juan",
  "Carlos",
  "Andrés",
  "Camilo",
  "Santiago",
  "Sebastián",
  "Felipe",
  "Daniel",
  "Mateo",
  "Nicolás",
  "David",
  "Julián",
  "Esteban",
  "Alejandro",
  "Diego",
  "Mauricio",
  "Jhon",
  "Cristian",
  "Wilson",
  "Óscar",
  "Luis",
  "Jorge",
  "Hernán",
  "Fabián",
  "Brayan",
  "Kevin",
  "Samuel",
  "Tomás",
  "Emilio",
  "Gustavo",
  "María",
  "Laura",
  "Paula",
  "Daniela",
  "Valentina",
  "Natalia",
  "Carolina",
  "Juliana",
  "Camila",
  "Andrea",
];

const APELLIDOS = [
  "Rodríguez",
  "Gómez",
  "Martínez",
  "López",
  "García",
  "Ramírez",
  "Hernández",
  "Torres",
  "Díaz",
  "Vargas",
  "Moreno",
  "Jiménez",
  "Rojas",
  "Castro",
  "Ortiz",
  "Gutiérrez",
  "Pérez",
  "Sánchez",
  "Cárdenas",
  "Mejía",
  "Quintero",
  "Salazar",
  "Ríos",
  "Acosta",
  "Beltrán",
  "Cortés",
  "Duarte",
  "Franco",
  "Guerrero",
  "Herrera",
  "Lozano",
  "Medina",
  "Navarro",
  "Ospina",
  "Parra",
  "Restrepo",
  "Suárez",
  "Valencia",
  "Zapata",
  "Bernal",
];

const NOTAS_ADMIN = [
  "Llegó sin cita",
  "Cliente frecuente",
  "Pidió el mismo corte de siempre",
  "Paga en efectivo",
];

export interface OpcionesDemo {
  /** Cuántas citas crear (por defecto 60). */
  cantidad?: number;
  /** Cambia el resultado; por defecto sale del negocio y del día (así es estable dentro del mismo día). */
  semilla?: string;
  generarToken?: () => string;
}

export interface DatosDemo {
  reservas: NuevaBooking[];
  bloqueos: NuevoBlock[];
}

// --- Azar reproducible ---------------------------------------------------------------------------

function hash(texto: string): number {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32: generador pseudoaleatorio pequeño; misma semilla, misma secuencia. */
function crearAzar(semilla: number) {
  let a = semilla;
  const siguiente = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    siguiente,
    entero: (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1)),
    elegir: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)],
    ponderado: <T>(lista: readonly T[], pesos: readonly number[]): T => {
      const total = pesos.reduce((s, p) => s + p, 0);
      let r = siguiente() * total;
      for (let i = 0; i < lista.length; i++) {
        r -= pesos[i];
        if (r < 0) return lista[i];
      }
      return lista[lista.length - 1];
    },
  };
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Cliente {
  nombre: string;
  celular: string;
  correo: string | null;
}

function crearClientes(azar: ReturnType<typeof crearAzar>, cantidad: number): Cliente[] {
  const usados = new Set<string>();
  const clientes: Cliente[] = [];
  while (clientes.length < cantidad) {
    const nombre = azar.elegir(NOMBRES);
    const apellido = azar.elegir(APELLIDOS);
    const completo = `${nombre} ${apellido}`;
    if (usados.has(completo)) continue;
    usados.add(completo);
    const n = clientes.length + 1;
    clientes.push({
      nombre: completo,
      // Números con aspecto inequívocamente ficticio (300 0000 + 3 dígitos).
      celular: `3000000${String(n).padStart(3, "0")}`,
      correo:
        azar.siguiente() < 0.2
          ? `${sinTildes(nombre)}.${sinTildes(apellido)}@correo.example`
          : null,
    });
  }
  return clientes;
}

// --- Generación ------------------------------------------------------------------------------------

interface Ocupado {
  ini: number;
  fin: number;
}

const MIN = 60_000;
const DIA_MS = 24 * 60 * MIN;

function minutosDeHora(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
}

function solapa(a: Ocupado, b: Ocupado): boolean {
  return a.ini < b.fin && b.ini < a.fin;
}

/**
 * Citas y bloqueos de ejemplo para un negocio. Reglas: dentro del horario del local y de la rejilla,
 * sin traslapes por profesional (como exige la base de datos), sin chocar con los bloqueos, estados
 * coherentes con la fecha (lo pasado se completó, faltó o se canceló; lo futuro está confirmado o
 * cancelado) y siempre algunas citas mañana para que "Recordatorios" tenga qué mostrar.
 */
export function generarDatosDemo(
  tenant: Tenant,
  ahora: Date,
  opciones: OpcionesDemo = {},
): DatosDemo {
  const objetivo = opciones.cantidad ?? 60;
  const generarToken = opciones.generarToken ?? (() => randomBytes(32).toString("base64url"));
  const hoy = hoyEnBogota(ahora);
  const azar = crearAzar(hash(opciones.semilla ?? `${tenant.slug}:${hoy}`));
  const clientes = crearClientes(azar, 36);

  // Ventana: 14 días atrás hasta 13 días adelante (la web reserva hasta ese límite).
  const dias = Array.from({ length: 28 }, (_, i) => sumarDias(hoy, i - 14)).filter(
    (f) => tenant.horario[diaDeSemana(f)] !== null,
  );
  const pesoDia = (f: string) => {
    const d = diaDeSemana(f);
    return (d === "vie" || d === "sab" ? 1.6 : 1) * (f === hoy ? 1.6 : 1);
  };

  const pesosServicio = tenant.servicios.map((_, i) => 1 / (i + 1));

  // --- bloqueos: de pocos, y siempre en días futuros para no confundir con citas pasadas ---
  const bloqueos: NuevoBlock[] = [];
  const bloqueosOcupado = new Map<string, Ocupado[]>(); // por profesional; "*" = todo el local
  const futuros = dias.filter((f) => f > hoy);
  const crearBloqueo = (
    fecha: string,
    desde: string,
    hasta: string,
    profesionalId: string | null,
    motivo: string,
  ) => {
    const ini = instanteBogota(fecha, minutosDeHora(desde));
    const fin = instanteBogota(fecha, minutosDeHora(hasta));
    bloqueos.push({
      tenantSlug: tenant.slug,
      professionalId: profesionalId,
      startsAt: ini,
      endsAt: fin,
      reason: motivo,
    });
    const clave = profesionalId ?? "*";
    bloqueosOcupado.set(clave, [
      ...(bloqueosOcupado.get(clave) ?? []),
      { ini: ini.getTime(), fin: fin.getTime() },
    ]);
  };
  if (futuros.length >= 6) {
    crearBloqueo(
      futuros[Math.floor(futuros.length / 2)],
      "12:00",
      "14:00",
      null,
      "Mantenimiento del local",
    );
    crearBloqueo(
      futuros[futuros.length - 3],
      "15:00",
      "17:00",
      tenant.profesionales.at(-1)!.id,
      "Cita médica",
    );
  }

  // --- citas ---
  const reservas: NuevaBooking[] = [];
  const ocupados = new Map<string, Ocupado[]>(); // citas activas por profesional

  function ranuras(fecha: string, servicio: Servicio): number[] {
    const rango = tenant.horario[diaDeSemana(fecha)];
    if (!rango) return [];
    const salida: number[] = [];
    const cierre = minutosDeHora(rango[1]);
    for (
      let m = minutosDeHora(rango[0]);
      m + servicio.duracionMin <= cierre;
      m += tenant.intervaloMin
    ) {
      salida.push(m);
    }
    return salida;
  }

  function estadoPara(inicio: Date, fin: Date, forzarConfirmada: boolean): NuevaBooking["status"] {
    if (forzarConfirmada) return "confirmada";
    const r = azar.siguiente();
    if (fin <= ahora) return r < 0.8 ? "completada" : r < 0.9 ? "no_asistio" : "cancelada";
    if (inicio <= ahora) return "confirmada"; // en curso
    return r < 0.93 ? "confirmada" : "cancelada";
  }

  /** Intenta crear una cita ese día; devuelve false si no encontró hueco. */
  function intentar(fecha: string, forzarConfirmada = false): boolean {
    const servicio = azar.ponderado(tenant.servicios, pesosServicio);
    const prof = azar.elegir(tenant.profesionales.filter((p) => p.servicios.includes(servicio.id)));
    const libres = ranuras(fecha, servicio);
    if (!prof || libres.length === 0) return false;

    const minutos = azar.elegir(libres);
    const inicio = instanteBogota(fecha, minutos);
    const fin = new Date(inicio.getTime() + servicio.duracionMin * MIN);

    const intervalo = { ini: inicio.getTime(), fin: fin.getTime() };
    if ((bloqueosOcupado.get("*") ?? []).some((b) => solapa(b, intervalo))) return false;
    if ((bloqueosOcupado.get(prof.id) ?? []).some((b) => solapa(b, intervalo))) return false;
    if ((ocupados.get(prof.id) ?? []).some((o) => solapa(o, intervalo))) return false;

    const status = estadoPara(inicio, fin, forzarConfirmada);
    // Una cancelada libera su hueco: otra cita puede ocuparlo.
    if (status !== "cancelada")
      ocupados.set(prof.id, [...(ocupados.get(prof.id) ?? []), intervalo]);

    const cliente = azar.elegir(clientes);
    const enPanel = azar.siguiente() < 0.15; // el resto, reserva web
    const sinCelular = enPanel && azar.siguiente() < 0.5;
    const creada = enPanel
      ? new Date(Math.min(inicio.getTime() - azar.entero(5, 60) * MIN, ahora.getTime()))
      : new Date(
          Math.min(
            inicio.getTime() - azar.entero(1, 6) * DIA_MS - azar.entero(0, 600) * MIN,
            ahora.getTime(),
          ),
        );

    let recordatorio: Date | null = null;
    const atendida = status === "completada" || status === "no_asistio";
    if (!enPanel && atendida && azar.siguiente() < 0.7)
      recordatorio = new Date(inicio.getTime() - DIA_MS);
    if (
      status === "confirmada" &&
      inicio > ahora &&
      inicio.getTime() - ahora.getTime() < 2 * DIA_MS &&
      azar.siguiente() < 0.25
    ) {
      recordatorio = new Date(ahora.getTime() - 60 * MIN);
    }

    reservas.push({
      tenantSlug: tenant.slug,
      serviceId: servicio.id,
      professionalId: prof.id,
      startsAt: inicio,
      endsAt: fin,
      customerName: cliente.nombre,
      customerPhone: sinCelular ? "" : cliente.celular,
      customerEmail: !enPanel ? cliente.correo : null,
      status,
      manageToken: generarToken(),
      source: enPanel ? "admin" : "web",
      notes: enPanel && azar.siguiente() < 0.6 ? azar.elegir(NOTAS_ADMIN) : null,
      reminderSentAt: recordatorio,
      createdAt: creada,
    });
    return true;
  }

  function agregar(n: number, elegirFecha: () => string, forzarConfirmada = false) {
    let creadas = 0;
    for (let intentos = 0; creadas < n && intentos < n * 80; intentos++) {
      if (intentar(elegirFecha(), forzarConfirmada)) creadas++;
    }
  }

  // Hoy es la pantalla que más se mira en una demo: nunca puede verse vacía (si el local abre).
  if (tenant.horario[diaDeSemana(hoy)] !== null) {
    agregar(Math.min(6, Math.floor(objetivo / 8)), () => hoy);
  }
  // Primero lo que no puede faltar: citas confirmadas mañana (si el local abre) para los recordatorios.
  const manana = sumarDias(hoy, 1);
  if (tenant.horario[diaDeSemana(manana)] !== null) {
    agregar(Math.min(5, Math.floor(objetivo / 8)), () => manana, true);
  }
  // Después, el resto repartido por la ventana (más los viernes, los sábados y hoy).
  agregar(Math.max(objetivo - reservas.length, 0), () => azar.ponderado(dias, dias.map(pesoDia)));

  reservas.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return { reservas, bloqueos };
}
