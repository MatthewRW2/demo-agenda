import { z } from "zod";

z.config(z.locales.es());

export const DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
export type Dia = (typeof DIAS)[number];

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

const slugSchema = z
  .string()
  .regex(SLUG_REGEX, "solo minúsculas, números y guiones (ej. don-carlos)");

const horaSchema = z.string().regex(HORA, "debe ser una hora HH:MM de 24 horas (ej. 09:00)");

const rangoSchema = z
  .tuple([horaSchema, horaSchema])
  .refine(([abre, cierra]) => abre < cierra, "la hora de apertura debe ser anterior al cierre");

const textoSchema = z.string().trim().min(1, "no puede estar vacío");

const servicioSchema = z.object({
  id: slugSchema,
  nombre: textoSchema,
  duracionMin: z.number().int().positive("debe ser un número entero de minutos mayor a 0"),
  precio: z.number().int().nonnegative("debe ser un número entero en COP, 0 o mayor"),
});

const profesionalSchema = z.object({
  id: slugSchema,
  nombre: textoSchema,
  foto: z.string().startsWith("/", "debe empezar con / (ruta dentro de public/)").optional(),
  servicios: z.array(slugSchema).min(1, "debe atender al menos un servicio"),
});

const horarioSchema = z.object({
  lun: rangoSchema.nullable(),
  mar: rangoSchema.nullable(),
  mie: rangoSchema.nullable(),
  jue: rangoSchema.nullable(),
  vie: rangoSchema.nullable(),
  sab: rangoSchema.nullable(),
  dom: rangoSchema.nullable(),
});

export const tenantSchema = z
  .object({
    slug: slugSchema,
    nombre: textoSchema,
    eslogan: textoSchema,
    logo: z.string().startsWith("/", "debe empezar con / (ruta dentro de public/)"),
    colores: z.object({
      primario: z.string().regex(COLOR, "debe ser un color hexadecimal #RRGGBB"),
      acento: z.string().regex(COLOR, "debe ser un color hexadecimal #RRGGBB"),
    }),
    whatsapp: z
      .string()
      .regex(/^57\d{10}$/, "debe incluir el indicativo 57 y 10 dígitos, sin + ni espacios"),
    direccion: textoSchema,
    instagram: z
      .string()
      .regex(/^[A-Za-z0-9._]{1,30}$/, "usuario de Instagram sin @ ni URL")
      .optional(),
    horario: horarioSchema,
    intervaloMin: z.number().int().min(5).max(120),
    anticipacionMinHoras: z.number().int().nonnegative(),
    diasReservables: z.number().int().min(1).max(90),
    servicios: z.array(servicioSchema).min(1, "debe haber al menos un servicio"),
    profesionales: z.array(profesionalSchema).min(1, "debe haber al menos un profesional"),
    textos: z
      .object({
        profesional: textoSchema.default("profesional"),
        reserva: textoSchema.default("cita"),
      })
      .default({ profesional: "profesional", reserva: "cita" }),
    demo: z.boolean().default(false),
  })
  .superRefine((tenant, ctx) => {
    const idsServicio = new Set<string>();
    tenant.servicios.forEach((s, i) => {
      if (idsServicio.has(s.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["servicios", i, "id"],
          message: `el id "${s.id}" está repetido`,
        });
      }
      idsServicio.add(s.id);
    });

    const idsProfesional = new Set<string>();
    tenant.profesionales.forEach((p, i) => {
      if (idsProfesional.has(p.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["profesionales", i, "id"],
          message: `el id "${p.id}" está repetido`,
        });
      }
      idsProfesional.add(p.id);
      p.servicios.forEach((sid, j) => {
        if (!idsServicio.has(sid)) {
          ctx.addIssue({
            code: "custom",
            path: ["profesionales", i, "servicios", j],
            message: `"${sid}" no es un servicio definido en "servicios"`,
          });
        }
      });
    });

    const atendidos = new Set(tenant.profesionales.flatMap((p) => p.servicios));
    tenant.servicios.forEach((s, i) => {
      if (!atendidos.has(s.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["servicios", i, "id"],
          message: `ningún profesional atiende "${s.id}", nadie podría reservarlo`,
        });
      }
    });

    if (DIAS.every((d) => tenant.horario[d] === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["horario"],
        message: "el negocio debe abrir al menos un día",
      });
    }
  });

export type Tenant = z.infer<typeof tenantSchema>;
export type Servicio = Tenant["servicios"][number];
export type Profesional = Tenant["profesionales"][number];
