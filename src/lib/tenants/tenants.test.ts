import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DIRECTORIO_TENANTS,
  TenantInvalidoError,
  cargarTenant,
  listarSlugs,
  validarTenant,
} from "./cargar";
import { iniciales } from "../texto";
import { crearNegocio } from "./crear";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function leerReal(nombre: string): Json {
  return JSON.parse(readFileSync(path.join(DIRECTORIO_TENANTS, nombre), "utf8"));
}

/** Devuelve los detalles del error para poder afirmar sobre el campo exacto. */
function detalles(datos: unknown): string[] {
  try {
    validarTenant(datos, "tenants/prueba.json");
  } catch (error) {
    if (error instanceof TenantInvalidoError) return error.detalles;
    throw error;
  }
  return [];
}

describe("archivos reales de tenants/", () => {
  it("don-carlos.json es válido", () => {
    expect(cargarTenant("don-carlos")?.nombre).toBe("Barbería Don Carlos");
  });

  it("_plantilla.json es válida (de ella nacen los negocios nuevos)", () => {
    expect(() => validarTenant(leerReal("_plantilla.json"), "_plantilla.json")).not.toThrow();
  });

  it("listarSlugs ignora la plantilla", () => {
    expect(listarSlugs()).toContain("don-carlos");
    expect(listarSlugs()).not.toContain("_plantilla");
  });
});

describe("validación: dice exactamente qué campo falla", () => {
  const base = () => leerReal("don-carlos.json");

  it("precio negativo en un servicio", () => {
    const t = base();
    t.servicios[1].precio = -5;
    expect(detalles(t)).toEqual([expect.stringContaining("servicios[1].precio:")]);
  });

  it("color que no es hexadecimal", () => {
    const t = base();
    t.colores.acento = "dorado";
    expect(detalles(t)).toEqual([expect.stringContaining("colores.acento:")]);
  });

  it("whatsapp sin indicativo", () => {
    const t = base();
    t.whatsapp = "3001234567";
    expect(detalles(t)).toEqual([expect.stringContaining("whatsapp:")]);
  });

  it("falta un día del horario", () => {
    const t = base();
    delete t.horario.mar;
    expect(detalles(t).join("\n")).toContain("horario.mar");
  });

  it("apertura posterior al cierre", () => {
    const t = base();
    t.horario.lun = ["19:00", "09:00"];
    expect(detalles(t).join("\n")).toContain("horario.lun");
  });

  it("hora mal escrita", () => {
    const t = base();
    t.horario.sab = ["8:00", "18:00"];
    expect(detalles(t).join("\n")).toContain("horario.sab[0]");
  });

  it("profesional que atiende un servicio inexistente", () => {
    const t = base();
    t.profesionales[2].servicios = ["corte", "tinte"];
    expect(detalles(t)).toEqual([
      expect.stringContaining('profesionales[2].servicios[1]: "tinte"'),
    ]);
  });

  it("servicio que ningún profesional atiende", () => {
    const t = base();
    t.servicios.push({ id: "masaje", nombre: "Masaje", duracionMin: 30, precio: 10000 });
    expect(detalles(t)).toEqual([expect.stringContaining("servicios[4].id:")]);
  });

  it("ids de servicio repetidos", () => {
    const t = base();
    t.servicios[1].id = "corte";
    expect(detalles(t).join("\n")).toContain("servicios[1].id");
  });

  it("slug con mayúsculas o espacios", () => {
    const t = base();
    t.slug = "Don Carlos";
    expect(detalles(t)).toEqual([expect.stringContaining("slug:")]);
  });

  it("slug reservado por la app", () => {
    const t = base();
    t.slug = "api";
    expect(detalles(t)).toEqual([expect.stringContaining("slug: es un nombre reservado")]);
  });

  it("negocio cerrado todos los días", () => {
    const t = base();
    for (const d of Object.keys(t.horario)) t.horario[d] = null;
    expect(detalles(t)).toEqual([expect.stringContaining("horario:")]);
  });

  it("junta varios errores en un solo mensaje", () => {
    const t = base();
    t.nombre = "";
    t.diasReservables = 0;
    const error = (() => {
      try {
        validarTenant(t, "tenants/prueba.json");
      } catch (e) {
        return e as Error;
      }
    })();
    expect(error?.message).toContain("tenants/prueba.json no es válido");
    expect(error?.message).toContain("nombre:");
    expect(error?.message).toContain("diasReservables:");
  });

  it("textos y demo tienen valores por defecto", () => {
    const t = base();
    delete t.textos;
    delete t.demo;
    const tenant = validarTenant(t, "x.json");
    expect(tenant.textos).toEqual({ profesional: "profesional", reserva: "cita" });
    expect(tenant.demo).toBe(false);
  });
});

describe("campos opcionales del rediseño", () => {
  const base = () => leerReal("don-carlos.json");

  it("un negocio sin imagenPortada, foto ni reseñas sigue siendo válido", () => {
    const t = base();
    delete t.imagenPortada;
    delete t.resenas;
    for (const p of t.profesionales) delete p.foto;
    expect(detalles(t)).toEqual([]);
  });

  it("imagenPortada debe ser una ruta dentro de public/", () => {
    const t = base();
    t.imagenPortada = "portada.jpg";
    expect(detalles(t)).toEqual([expect.stringContaining("imagenPortada:")]);
  });

  it("una reseña sin estrellas toma 5 y una con 9 se rechaza", () => {
    const t = base();
    t.resenas = [{ autor: "Ana", texto: "Muy buen servicio" }];
    expect(detalles(t)).toEqual([]);
    t.resenas = [{ autor: "Ana", texto: "Muy buen servicio", estrellas: 9 }];
    expect(detalles(t)).toEqual([expect.stringContaining("resenas[0].estrellas:")]);
  });
});

describe("contactoDemo (opcional)", () => {
  const base = () => leerReal("don-carlos.json");

  it("sin contactoDemo sigue siendo válido", () => {
    const t = base();
    delete t.contactoDemo;
    expect(detalles(t)).toEqual([]);
  });

  it("acepta nombre, WhatsApp e Instagram", () => {
    const t = base();
    t.contactoDemo = { nombre: "Mateo", whatsapp: "573109998877", instagram: "mi.perfil" };
    expect(detalles(t)).toEqual([]);
  });

  it("rechaza un WhatsApp sin indicativo y un Instagram con @", () => {
    const t = base();
    t.contactoDemo = { whatsapp: "3109998877", instagram: "@mi.perfil" };
    expect(detalles(t)).toEqual([
      expect.stringContaining("contactoDemo.whatsapp:"),
      expect.stringContaining("contactoDemo.instagram:"),
    ]);
  });

  it("las demos no traen un Instagram de relleno que pueda ser de alguien real", () => {
    for (const slug of ["don-carlos", "clinica-sonrisa"]) {
      expect(leerReal(slug + ".json").instagram).toBeUndefined();
    }
  });
});

describe("cargarTenant", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "tenants-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("devuelve null si no existe", () => {
    expect(cargarTenant("no-existe", dir)).toBeNull();
  });

  it("devuelve null (sin tocar el disco) si el slug intenta salirse de la carpeta", () => {
    expect(cargarTenant("../package", dir)).toBeNull();
    expect(cargarTenant("..\\package", dir)).toBeNull();
  });

  it("explica un JSON mal formado", () => {
    writeFileSync(path.join(dir, "roto.json"), "{ esto no es json");
    expect(() => cargarTenant("roto", dir)).toThrow(
      /tenants\/roto\.json no es válido[\s\S]*no es JSON válido/,
    );
  });

  it("exige que el slug del archivo coincida con el nombre del archivo", () => {
    writeFileSync(path.join(dir, "otro.json"), JSON.stringify(leerReal("don-carlos.json")));
    expect(() => cargarTenant("otro", dir)).toThrow(
      /slug: es "don-carlos" pero el archivo se llama "otro\.json"/,
    );
  });
});

describe("crearNegocio", () => {
  let raiz: string;
  beforeEach(() => {
    raiz = mkdtempSync(path.join(tmpdir(), "proyecto-"));
    mkdirSync(path.join(raiz, "tenants"));
    writeFileSync(
      path.join(raiz, "tenants", "_plantilla.json"),
      readFileSync(path.join(DIRECTORIO_TENANTS, "_plantilla.json")),
    );
  });
  afterEach(() => rmSync(raiz, { recursive: true, force: true }));

  it("crea un consultorio válido con su carpeta y logo", () => {
    const { archivoJson, carpetaImagenes } = crearNegocio({
      slug: "clinica-sonrisa",
      nombre: "Clínica Dental Sonrisa",
      raiz,
    });
    const tenant = cargarTenant("clinica-sonrisa", path.join(raiz, "tenants"));
    expect(tenant?.nombre).toBe("Clínica Dental Sonrisa");
    expect(tenant?.logo).toBe("/tenants/clinica-sonrisa/logo.svg");
    expect(existsSync(archivoJson)).toBe(true);
    const logo = readFileSync(path.join(carpetaImagenes, "logo.svg"), "utf8");
    expect(logo).toContain("<svg");
    expect(logo).toContain("CD");
  });

  it("escapa comillas en el nombre", () => {
    crearNegocio({ slug: "el-rey", nombre: 'Barbería "El Rey"', raiz });
    expect(cargarTenant("el-rey", path.join(raiz, "tenants"))?.nombre).toBe('Barbería "El Rey"');
  });

  it("rechaza un slug inválido", () => {
    expect(() => crearNegocio({ slug: "Mi Negocio", nombre: "X", raiz })).toThrow(/slug/);
  });

  it("no sobrescribe un negocio existente", () => {
    crearNegocio({ slug: "uno", nombre: "Uno", raiz });
    expect(() => crearNegocio({ slug: "uno", nombre: "Otro", raiz })).toThrow(/Ya existe/);
  });
});

describe("iniciales", () => {
  it("toma las dos primeras palabras significativas", () => {
    expect(iniciales("Clínica Dental Sonrisa")).toBe("CD");
    expect(iniciales("Spa de la Luna")).toBe("SL");
    expect(iniciales("Álvaro")).toBe("Á");
    expect(iniciales("Dra. Laura Mejía")).toBe("LM");
    expect(iniciales("Dr. Andrés Pardo")).toBe("AP");
    expect(iniciales("Sra. de la Luna")).toBe("L");
    expect(iniciales("   ")).toBe("?");
  });
});
