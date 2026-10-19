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

| Variable         | Obligatoria | Descripción                                 |
| ---------------- | ----------- | ------------------------------------------- |
| `DATABASE_URL`   | Sí (Fase 2) | Cadena de conexión Postgres (Neon)          |
| `ADMIN_PASSWORD` | Sí (Fase 7) | Contraseña del panel `/<slug>/admin`        |
| `RESEND_API_KEY` | No          | Si falta, no se envían correos y nada falla |
| `APP_URL`        | Sí          | URL pública de la app, sin barra final      |
| `CRON_SECRET`    | Sí (Fase 8) | Protege el cron que restablece la demo      |

## Scripts

| Comando                                      | Qué hace                                 |
| -------------------------------------------- | ---------------------------------------- |
| `npm run dev`                                | Servidor de desarrollo                   |
| `npm run build`                              | Compilación de producción                |
| `npm run lint`                               | ESLint                                   |
| `npm run typecheck`                          | TypeScript sin emitir                    |
| `npm test`                                   | Pruebas unitarias (Vitest)               |
| `npm run format`                             | Formatea con Prettier                    |
| `npm run nuevo-negocio -- <slug> "<Nombre>"` | Crea un negocio nuevo desde la plantilla |
| `npm run validar-tenants`                    | Valida todos los JSON de `tenants/`      |

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

> Las secciones de despliegue y la guía completa de demos personalizadas se completan en las Fases 10 y 11.
