# Demo de agendamiento

Sistema de reservas en línea para barberías, consultorios y spas. Es una demo de ventas: cada
negocio es un archivo JSON en `tenants/`, sin tocar código. El diseño ("tarjeta de cita": un tiquete con
talón) toma sus colores, textos y fotos del JSON y se ve bien con cualquier par de colores.

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

| Variable                | Obligatoria                 | Descripción                                                                                                                           |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Sí                          | Conexión a Postgres en Neon (con pooler)                                                                                              |
| `DATABASE_URL_UNPOOLED` | Solo para migraciones       | Conexión directa de Neon (sin pooler); la usa `npm run db:migrate`, no hace falta en Vercel                                           |
| `ADMIN_PASSWORD`        | Sí, para usar el panel      | Contraseña del panel `/<slug>/admin`. Sin ella el panel queda cerrado                                                                 |
| `CRON_SECRET`           | Sí, para el cron de la demo | Protege `/api/cron/restablecer-demo`. Sin ella el cron responde 401                                                                   |
| `APP_URL`               | En producción               | URL pública sin barra final; se usa en la vista previa del link y en los correos. Si falta, se usa el dominio de producción de Vercel |
| `RESEND_API_KEY`        | No                          | Si falta, no se envían correos y nada falla                                                                                           |
| `RESEND_FROM`           | No                          | Remitente de los correos (por defecto, el de pruebas de Resend)                                                                       |

## Scripts

| Comando                                      | Qué hace                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                                | Servidor de desarrollo                                                                        |
| `npm run build`                              | Compilación de producción                                                                     |
| `npm run lint`                               | ESLint                                                                                        |
| `npm run typecheck`                          | TypeScript sin emitir                                                                         |
| `npm test`                                   | Pruebas unitarias (Vitest)                                                                    |
| `npm run format`                             | Formatea con Prettier                                                                         |
| `npm run nuevo-negocio -- <slug> "<Nombre>"` | Crea un negocio nuevo desde la plantilla                                                      |
| `npm run db:generate`                        | Genera una migración a partir de `src/db/schema.ts`                                           |
| `npm run db:migrate`                         | Aplica las migraciones a `DATABASE_URL`                                                       |
| `npm run seed -- <slug>`                     | Reemplaza las citas y bloqueos de un negocio demo por datos de ejemplo                        |
| `npm run verificar-despliegue -- <url>`      | Comprobaciones de humo sobre una app desplegada                                               |
| `npm run db:verificar`                       | Prueba la base real: restricción anti-traslape                                                |
| `npm run test:e2e`                           | Pruebas de punta a punta con Playwright (usa Chrome y la base real; vuelve a sembrar la demo) |
| `npm run validar-tenants`                    | Valida todos los JSON de `tenants/` (`-- --estricto`: los avisos también fallan)              |
| `npm run vaciar-demo -- <slug>`              | Borra las citas y bloqueos de un negocio demo (para pasarlo a cliente real)                   |

## Negocios (tenants)

Cada negocio es `tenants/<slug>.json`, validado con Zod al cargarse. Si un campo está mal, el error
indica cuál (por ejemplo `servicios[1].precio: debe ser un número entero en COP, 0 o mayor`).
`tenants/_plantilla.json` es la base de los negocios nuevos; los archivos que empiezan por `_` no
cuentan como negocios.

```bash
npm run nuevo-negocio -- mi-negocio "Mi Negocio"
npm run validar-tenants
```

Las imágenes de cada negocio viven en `public/tenants/<slug>/`. Campos opcionales (todos con respaldo si
faltan, así que crear una demo sigue siendo copiar el JSON y cambiar colores, logo y servicios):

- `imagenPortada`: foto horizontal de la portada (sin ella, un campo liso del color primario);
- `foto` de cada profesional: retrato vertical (sin ella, sus iniciales);
- `resenas`: reseñas reales (hasta 6). Sin reseñas, solo las demo (`"demo": true`) muestran tres de ejemplo,
  rotuladas "Reseñas de ejemplo"; un negocio real sin reseñas no muestra la sección.

Las fotos de las demos son de Pexels; créditos y licencia en [docs/creditos-imagenes.md](docs/creditos-imagenes.md).

## Base de datos

Postgres en [Neon](https://neon.tech) (plan gratuito) con Drizzle ORM. Define `DATABASE_URL` y
`DATABASE_URL_UNPOOLED` en `.env.local` (con `neon deploy` se escriben solos) y corre
`npm run db:migrate`. Comprueba la conexión con `npm run db:verificar` o con `GET /api/salud`. Las migraciones están en `drizzle/`.

Las dobles reservas se evitan **en la base de datos**: la restricción `bookings_sin_traslape`
(`EXCLUDE USING gist`, extensión `btree_gist`) rechaza dos reservas activas solapadas del mismo
profesional. `npm test` la verifica contra un Postgres embebido, sin necesidad de Neon.

## Página pública

`/<slug>` es estática y rápida: portada con foto, la tarjeta del próximo turno libre, servicios, equipo,
reseñas, horario y mapa. Lo que cambia con la hora se completa en el navegador: "Abierto ahora" (hora de
Bogotá) y el próximo turno y "Turnos hoy" de cada profesional, que salen de `GET /api/disponibilidad/<slug>`
(mismo motor que la reserva, con caché corta). Los botones "Reservar este", "Reservar con X" y cada horario de
la tarjeta abren el flujo con la elección hecha (`?servicio=&profesional=&fecha=&hora=`); es solo comodidad de
la interfaz, se valida y la reserva se vuelve a comprobar en el servidor.

## Reservas

El cliente reserva en `/<slug>/reservar` (servicio, profesional, día y hora —agrupadas en mañana, tarde y
noche—, datos) con un resumen de su cita siempre a la vista, y recibe un
enlace secreto `/<slug>/cita/<token>` con su código, "Agregar a Google Calendar" y "Confirmar por
WhatsApp". Si escribe su correo y hay `RESEND_API_KEY`, también le llega por correo.

Desde ese enlace (la confirmación es un tiquete con código y estado) el cliente puede **cancelar** o **cambiar el día u hora** de su cita, siempre que falte
al menos la anticipación mínima del negocio (`anticipacionMinHoras`); si falta menos, se le ofrece WhatsApp.

## Panel del negocio

`/<slug>/admin` (contraseña = `ADMIN_PASSWORD`; en los negocios con `"demo": true` se muestra en la pantalla de
acceso). Tiene:

- **Agenda** por día (una columna por profesional) y por semana; cambiar el estado de cada cita (completada,
  no asistió, cancelada), crear citas manuales para quien llega sin reserva y bloquear horarios.
- **Recordatorios**: las citas de mañana, con botón de WhatsApp que marca el recordatorio como enviado.
- **Métricas de la semana**: citas, % de inasistencias, ingresos estimados, servicio más pedido y hora más ocupada.

Si `ADMIN_PASSWORD` no está definida, el panel queda cerrado. Cambiarla cierra todas las sesiones.

## Modo demo

Con `"demo": true` en el JSON del negocio:

- aparece la franja "Demo con datos ficticios" arriba de todas las pantallas;
- los botones de WhatsApp e Instagram usan solo `contactoDemo` (tu contacto; sin él no se muestran) y nunca el número del JSON;
- el formulario de reserva avisa que se pueden usar datos inventados;
- el panel muestra la contraseña en la pantalla de acceso y un botón **Restablecer demo**;
- `npm run seed -- <slug>` crea ~60 citas ficticias (últimas 2 semanas y próximas 2, con inasistencias y
  cancelaciones) y 2 bloqueos. **Borra las citas y bloqueos que hubiera** de ese negocio, y se niega con
  uno que tenga `"demo": false`;
- el cron diario `GET /api/cron/restablecer-demo` (configurado en `vercel.json`) vuelve a sembrar todos los
  negocios demo. Está protegido con `CRON_SECRET` (Vercel lo envía como `Authorization: Bearer ...`).

Para un cliente real, cambia `"demo"` a `false`: desaparecen la franja y la contraseña en pantalla, y ningún
comando, botón ni cron puede tocar sus datos.

Pruebas de punta a punta: `npm run test:e2e` (compila la app, la levanta en el puerto 3200 y crea y
borra reservas "E2E ..." en la base de `DATABASE_URL`).

## Despliegue

Guía paso a paso (GitHub, Neon, Vercel, migraciones, cron y verificación en el celular): **[docs/despliegue.md](docs/despliegue.md)**.

## Demo personalizada para un prospecto

Menos de 20 minutos por prospecto, sin tocar código: `npm run nuevo-negocio`, editar el JSON (nombre, logo,
colores, servicios y precios de su Instagram o ficha de Google), subir el logo, `npm run seed -- <slug>` y
`git push`. Guía completa, con la tabla de campos, una lista de revisión y cómo convertir la demo en un cliente
real: **[docs/nueva-demo.md](docs/nueva-demo.md)**.

Negocios incluidos: `don-carlos` (barbería, `"profesional": "barbero"`) y `clinica-sonrisa` (consultorio
odontológico, `"profesional": "odontólogo"`), este último creado con ese mismo proceso para probarlo.
