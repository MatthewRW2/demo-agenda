import type { Tenant } from "@/lib/tenants/schema";

/** Negocio ficticio fijo para las pruebas (no depende de lo que se edite en tenants/). */
export const tenantDePrueba: Tenant = {
  slug: "prueba",
  nombre: "Barbería de Prueba",
  eslogan: "Para las pruebas",
  logo: "/logo.svg",
  colores: { primario: "#111111", acento: "#c8a24a" },
  whatsapp: "573001234567",
  direccion: "Calle 1 #2-3, Bogotá",
  horario: {
    lun: ["09:00", "19:00"],
    mar: ["09:00", "19:00"],
    mie: ["09:00", "19:00"],
    jue: ["09:00", "19:00"],
    vie: ["09:00", "20:00"],
    sab: ["08:00", "18:00"],
    dom: null,
  },
  intervaloMin: 15,
  anticipacionMinHoras: 2,
  diasReservables: 14,
  servicios: [
    { id: "corte", nombre: "Corte", duracionMin: 30, precio: 25000 },
    { id: "corte-barba", nombre: "Corte + barba", duracionMin: 50, precio: 40000 },
    { id: "nino", nombre: "Corte niño", duracionMin: 25, precio: 20000 },
  ],
  profesionales: [
    { id: "carlos", nombre: "Carlos", servicios: ["corte", "corte-barba"] },
    { id: "andres", nombre: "Andrés", servicios: ["corte", "corte-barba", "nino"] },
    { id: "mateo", nombre: "Mateo", servicios: ["corte", "nino"] },
  ],
  textos: { profesional: "barbero", reserva: "cita" },
  contactoDemo: { nombre: "Mateo", whatsapp: "573109998877" },
  demo: true,
};
