# Demo de agendamiento para barberías — instrucciones para Claude Code

## Contexto (léelo antes de empezar)

Vas a construir una **demo de ventas**: un sistema de reservas en línea para una barbería ficticia, "Barbería Don Carlos" (Bogotá). Se usará para mostrarlo a dueños de barberías, consultorios y spas desde el celular, y para crear en minutos versiones personalizadas con el nombre, logo y servicios de un prospecto real.

Prioridades, en este orden:
1. **Se ve y funciona perfecto en el celular.** El prospecto lo abrirá desde un link de WhatsApp.
2. **Todo lo de la marca sale de configuración**, nunca del código. Crear un negocio nuevo = un archivo JSON nuevo.
3. **Costo $0**: solo planes gratuitos. No agregues ningún servicio de pago sin preguntarme.
4. Código limpio y mantenible: esto puede convertirse en producto real para clientes.

Forma de trabajar:
- Avanza **por fases**, en orden. Al terminar cada fase: corre lint, tipos y pruebas; haz un commit con mensaje claro; dime qué quedó y qué sigue.
- Si algo es ambiguo, elige lo más simple y anótalo en `DECISIONES.md`.
- Toda la interfaz en **español de Colombia**. Precios en COP con `Intl.NumberFormat('es-CO')`. Zona horaria **America/Bogota** siempre (guarda en UTC, muestra en Bogotá).

## Stack

| Pieza | Elección | Por qué |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript estricto | Front y back en un solo proyecto |
| Estilos | Tailwind CSS + componentes de shadcn/ui | Rápido y consistente |
| Base de datos | Postgres en **Neon** (plan gratuito) | Se reactiva sola tras inactividad, a diferencia de otras opciones gratuitas que pausan el proyecto |
| ORM | Drizzle ORM + drizzle-kit (migraciones) | Liviano, tipado |
| Validación | Zod | Formularios y API |
| Fechas | date-fns + @date-fns/tz | Zona horaria de Bogotá |
| Correo (opcional) | Resend, plan gratuito | Confirmaciones por email |
| Pruebas | Vitest (unitarias) + Playwright (flujo de reserva) | |
| Despliegue | Vercel, plan Hobby | Gratis, conecta con GitHub |

Nota: el plan Hobby de Vercel está pensado para uso personal y no comercial. Sirve para la demo; cuando un cliente pague, el sistema va en su propia cuenta o en un plan adecuado. Verifica los términos vigentes.

## Estructura de multi-negocio (clave para las demos personalizadas)

- Cada negocio vive en `tenants/<slug>.json`. Las rutas son `/<slug>` (pública) y `/<slug>/admin`.
- La raíz `/` redirige a `/don-carlos`.
- Esquema del JSON (valídalo con Zod al cargar):

```json
{
  "slug": "don-carlos",
  "nombre": "Barbería Don Carlos",
  "eslogan": "Cortes clásicos y modernos en Chapinero",
  "logo": "/tenants/don-carlos/logo.svg",
  "colores": { "primario": "#1F2937", "acento": "#C8A24A" },
  "whatsapp": "573001234567",
  "direccion": "Cra. 13 #54-20, Chapinero, Bogotá",
  "instagram": "barberiadoncarlos",
  "horario": {
    "lun": ["09:00", "19:00"], "mar": ["09:00", "19:00"], "mie": ["09:00", "19:00"],
    "jue": ["09:00", "19:00"], "vie": ["09:00", "20:00"], "sab": ["08:00", "18:00"], "dom": null
  },
  "intervaloMin": 15,
  "anticipacionMinHoras": 2,
  "diasReservables": 14,
  "servicios": [
    { "id": "corte", "nombre": "Corte clásico", "duracionMin": 30, "precio": 25000 },
    { "id": "corte-barba", "nombre": "Corte + barba", "duracionMin": 50, "precio": 40000 },
    { "id": "barba", "nombre": "Arreglo de barba", "duracionMin": 25, "precio": 18000 },
    { "id": "nino", "nombre": "Corte niño", "duracionMin": 25, "precio": 20000 }
  ],
  "profesionales": [
    { "id": "carlos", "nombre": "Carlos", "foto": "/tenants/don-carlos/carlos.jpg", "servicios": ["corte", "corte-barba", "barba"] },
    { "id": "andres", "nombre": "Andrés", "foto": "/tenants/don-carlos/andres.jpg", "servicios": ["corte", "corte-barba", "barba", "nino"] },
    { "id": "mateo", "nombre": "Mateo", "foto": "/tenants/don-carlos/mateo.jpg", "servicios": ["corte", "nino"] }
  ],
  "textos": { "profesional": "barbero", "reserva": "cita" },
  "demo": true
}
```

- `textos` permite reusar la misma app para consultorios ("profesional": "doctor") o spas sin tocar código.
- Imágenes: usa placeholders o avatares generados con iniciales; nada con derechos de autor.
- Los colores se inyectan como variables CSS desde el JSON.

## Modelo de datos

- `bookings`: id, tenant_slug, service_id, professional_id, starts_at, ends_at (timestamptz, UTC), customer_name, customer_phone, customer_email (opcional), status (`confirmada` | `completada` | `no_asistio` | `cancelada`), manage_token (aleatorio, único), source (`web` | `admin`), notes, created_at.
- `blocks`: id, tenant_slug, professional_id (o null = todo el local), starts_at, ends_at, reason.
- **Evita dobles reservas en la base de datos**, no solo en el código: restricción de exclusión con `btree_gist` sobre (tenant_slug, professional_id, rango de tiempo) para reservas con estado distinto de `cancelada`. Maneja el error con un mensaje amable ("Ese horario se acaba de ocupar, elige otro").

## Fases

### Fase 0 — Proyecto base
- Crear el proyecto Next.js con TypeScript estricto, Tailwind, ESLint, Prettier, Vitest.
- `.env.example` con: `DATABASE_URL`, `ADMIN_PASSWORD`, `RESEND_API_KEY` (opcional), `APP_URL`, `CRON_SECRET`.
- README inicial.
- **Listo cuando:** `npm run dev`, `npm run lint`, `npm run typecheck` y `npm test` pasan.

### Fase 1 — Configuración de negocios
- Cargador de tenants con validación Zod y errores claros si un JSON está mal.
- `tenants/don-carlos.json` y `tenants/_plantilla.json`.
- Script `npm run nuevo-negocio -- <slug> "<Nombre>"` que copia la plantilla y crea su carpeta de imágenes.
- **Listo cuando:** un JSON inválido muestra exactamente qué campo falla.

### Fase 2 — Base de datos
- Esquema Drizzle, migraciones, restricción de exclusión.
- **Listo cuando:** las migraciones corren contra Neon y la restricción rechaza un traslape en una prueba.

### Fase 3 — Motor de disponibilidad (lo más importante)
- Función pura `calcularHorarios(tenant, servicio, profesional | "cualquiera", fecha, reservas, bloqueos, ahora)` que devuelve los horarios libres.
- Reglas: horario del local, duración del servicio, intervalo, anticipación mínima, días reservables, reservas y bloqueos existentes. "Cualquiera" une la disponibilidad de los profesionales que hacen ese servicio y asigna al menos ocupado.
- **Pruebas unitarias** de: día cerrado, servicio que no cabe antes del cierre, traslapes, anticipación mínima, cambio de día en Bogotá frente a UTC y "cualquiera".
- **Listo cuando:** todas las pruebas pasan.

### Fase 4 — Página pública del negocio (`/<slug>`)
- Mobile-first: portada con logo, nombre y eslogan; botón grande "Reservar"; servicios con duración y precio; profesionales con foto; horario; dirección con mapa embebido de Google Maps por dirección (sin API key); botones de WhatsApp e Instagram.
- Etiquetas Open Graph e imagen de vista previa generada con el nombre y colores del negocio, **para que el link se vea bien al enviarlo por WhatsApp**.
- **Listo cuando:** Lighthouse móvil ≥ 90 en rendimiento y accesibilidad.

### Fase 5 — Flujo de reserva
- Pasos: servicio → profesional (o "cualquiera") → fecha (carrusel de los próximos días) → hora → datos (nombre, celular colombiano validado, correo opcional) → confirmación.
- Confirmación con: resumen, código de reserva, botón "Agregar a Google Calendar" (link con plantilla), botón "Confirmar por WhatsApp" (link `wa.me` al negocio con el mensaje precargado) y link para gestionar la cita.
- Si hay `RESEND_API_KEY`, enviar correo de confirmación; si no, omitirlo sin fallar.
- Protección básica: límite de reservas por celular y por IP, y validación en el servidor.
- **Listo cuando:** una prueba de Playwright completa una reserva de principio a fin y otra verifica que el horario ya no aparece libre.

### Fase 6 — Gestionar la cita
- `/<slug>/cita/<token>`: ver, cancelar o reprogramar (reusa el selector de fecha y hora), respetando la anticipación mínima.

### Fase 7 — Panel del negocio (`/<slug>/admin`)
- Acceso con `ADMIN_PASSWORD` y cookie httpOnly firmada. En modo demo, muestra la contraseña en la pantalla de acceso para que el prospecto entre.
- **Agenda:** vista de día (columnas por profesional) y de semana, cambio de estado de cada cita, crear cita manual para clientes que llegan sin reserva, bloquear horarios.
- **Recordatorios:** lista de citas de mañana con botón "Enviar recordatorio" que abre `wa.me` con el mensaje precargado ("Hola [nombre], te recordamos tu cita mañana a las [hora] en [negocio]…") y marca el recordatorio como enviado.
- **Métricas de la semana:** citas, inasistencias (%), ingresos estimados, servicio más pedido y hora más ocupada.

### Fase 8 — Modo demo
- Si `demo: true`: franja discreta arriba ("Demo con datos ficticios").
- Script `npm run seed -- <slug>` que crea ~60 citas realistas (nombres colombianos ficticios) en las últimas 2 semanas y las próximas 2, con algunas inasistencias y cancelaciones, para que el panel se vea vivo.
- Botón "Restablecer demo" en el admin y un cron diario de Vercel (protegido con `CRON_SECRET`) que vuelve a sembrar los datos. El plan gratuito de Vercel limita la frecuencia de los cron; una vez al día basta.

### Fase 9 — Pulido
- Estados vacíos, cargando y error en todas las pantallas; textos amables.
- Accesibilidad: contraste, foco visible, etiquetas en formularios.
- Página 404 propia.
- **Listo cuando:** recorres el flujo completo en un celular real sin nada raro.

### Fase 10 — Despliegue gratuito
Dame los pasos exactos para:
1. Crear el repositorio en GitHub y subir el código.
2. Crear el proyecto en Neon (región más cercana a Colombia disponible) y copiar `DATABASE_URL`.
3. Importar el repo en Vercel, configurar las variables de entorno y desplegar.
4. Correr migraciones y seed contra producción.
5. Configurar el cron.
6. Verificar en el celular: reserva, WhatsApp, panel, vista previa del link en WhatsApp.

### Fase 11 — Demo personalizada en minutos
- Documenta en el README cómo crear la versión de un prospecto: `npm run nuevo-negocio`, editar el JSON (nombre, logo, colores, servicios y precios de su Instagram o ficha de Google), subir el logo, `npm run seed`, hacer push. Objetivo: **menos de 20 minutos por prospecto**.
- Prueba el proceso creando un segundo negocio ficticio que no sea barbería: un consultorio odontológico con `"profesional": "odontólogo"`.

## Fuera de alcance (no lo hagas)
- API oficial de WhatsApp Business, pagos en línea, apps nativas y multiusuario con roles. Se cotizan aparte cuando un cliente los pida.

## Entregable final
- URL pública funcionando: `/don-carlos`, `/don-carlos/admin` y el consultorio de prueba.
- README con instalación, variables, despliegue y creación de negocios.
- `DECISIONES.md` con las decisiones tomadas.
