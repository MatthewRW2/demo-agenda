# Demo de agendamiento

Sistema de reservas en línea para barberías, consultorios y spas. Es una demo de ventas: cada
negocio es un archivo JSON en `tenants/`, sin tocar código.

## Requisitos

- Node.js 20.19+ (probado con 24)
- npm

## Instalación

```bash
npm install
cp .env.example .env.local   # y completa los valores
npm run dev                  # http://localhost:3000
```

## Variables de entorno

| Variable                | Obligatoria      | Descripción                                 |
| ----------------------- | ---------------- | ------------------------------------------- |
| `DATABASE_URL`          | Sí               | Conexión a Postgres en Neon (con pooler)    |
| `DATABASE_URL_UNPOOLED` | Para migraciones | Conexión directa de Neon (sin pooler)       |
| `ADMIN_PASSWORD`        | Sí (Fase 7)      | Contraseña del panel `/<slug>/admin`        |
| `RESEND_API_KEY`        | No               | Si falta, no se envían correos y nada falla |
| `APP_URL`               | Sí               | URL pública de la app, sin barra final      |
| `CRON_SECRET`           | Sí (Fase 8)      | Protege el cron que restablece la demo      |

## Scripts

| Comando                                      | Qué hace                                                    |
| -------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                | Servidor de desarrollo                                      |
| `npm run build`                              | Compilación de producción                                   |
| `npm run lint`                               | ESLint                                                      |
| `npm run typecheck`                          | TypeScript sin emitir                                       |
| `npm test`                                   | Pruebas unitarias (Vitest)                                  |
| `npm run format`                             | Formatea con Prettier                                       |
| `npm run nuevo-negocio -- <slug> "<Nombre>"` | Crea un negocio nuevo desde la plantilla                    |
| `npm run db:generate`                        | Genera una migración a partir de `src/db/schema.ts`         |
| `npm run db:migrate`                         | Aplica las migraciones a `DATABASE_URL`                     |
| `npm run db:verificar`                       | Prueba la base real: restricción anti-traslape              |
| `npm run test:e2e`                           | Flujo de reserva con Playwright (usa Chrome y la base real) |
| `npm run validar-tenants`                    | Valida todos los JSON de `tenants/`                         |

## Negocios (tenants)

Cada negocio es `tenants/<slug>.json`, validado con Zod al cargarse. Si un campo está mal, el error
indica cuál (por ejemplo `servicios[1].precio: debe ser un número entero en COP, 0 o mayor`).
`tenants/_plantilla.json` es la base de los negocios nuevos; los archivos que empiezan por `_` no
cuentan como negocios.

```bash
npm run nuevo-negocio -- clinica-sonrisa "Clínica Dental Sonrisa"
npm run validar-tenants
```

Las imágenes de cada negocio viven en `public/tenants/<slug>/`.

## Base de datos

Postgres en [Neon](https://neon.tech) (plan gratuito) con Drizzle ORM. Define `DATABASE_URL` y
`DATABASE_URL_UNPOOLED` en `.env.local` (con `neon deploy` se escriben solos) y corre
`npm run db:migrate`. Comprueba la conexión con `npm run db:verificar` o con `GET /api/salud`. Las migraciones están en `drizzle/`.

Las dobles reservas se evitan **en la base de datos**: la restricción `bookings_sin_traslape`
(`EXCLUDE USING gist`, extensión `btree_gist`) rechaza dos reservas activas solapadas del mismo
profesional. `npm test` la verifica contra un Postgres embebido, sin necesidad de Neon.

## Reservas

El cliente reserva en `/<slug>/reservar` (servicio, profesional, día y hora, datos) y recibe un
enlace secreto `/<slug>/cita/<token>` con su código, "Agregar a Google Calendar" y "Confirmar por
WhatsApp". Si escribe su correo y hay `RESEND_API_KEY`, también le llega por correo.

Desde ese enlace el cliente puede **cancelar** o **cambiar el día u hora** de su cita, siempre que falte
al menos la anticipación mínima del negocio (`anticipacionMinHoras`); si falta menos, se le ofrece WhatsApp.

Pruebas de punta a punta: `npm run test:e2e` (compila la app, la levanta en el puerto 3200 y crea y
borra reservas "E2E ..." en la base de `DATABASE_URL`).

> Las secciones de despliegue y la guía completa de demos personalizadas se completan en las Fases 10 y 11.
