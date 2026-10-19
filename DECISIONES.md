# Decisiones

Registro de decisiones donde las instrucciones eran ambiguas o hubo que elegir.

## Fase 0

- **Next.js 16 sin `cacheComponents` ni `partialPrefetching`.** El scaffold los activa por defecto,
  pero obligan a envolver en Suspense todo acceso dinámico (BD, cookies). La app es casi toda
  dinámica; se mantiene lo simple. Se pueden reactivar más adelante si hace falta.
- **`@types/node` 24** (coincide con el Node local); vitest 5 lo exige como peer.
- **Vitest en entorno `node`** por ahora; la lógica (disponibilidad, tenants) es pura.
- **`npm audit` reporta 5 vulnerabilidades altas** en `braces`/`fast-glob`, dependencias
  transitivas de `eslint-config-next` (solo herramienta de lint, no llegan a producción). El "fix"
  propuesto degrada a Next 14, así que se ignora.
- **Comando `typecheck`** = `tsc --noEmit`.

## Fase 1

- **Zod 4 con mensajes en español** (`z.locales.es()`) más mensajes propios en las reglas de negocio.
- **Reglas extra del esquema** (más allá del JSON de ejemplo): ids de servicio y de profesional
  únicos; todo servicio debe ser atendido por al menos un profesional (si no, nadie podría
  reservarlo); cada profesional solo puede referirse a servicios que existen; el negocio debe abrir
  al menos un día; apertura anterior al cierre; WhatsApp con formato `57` + 10 dígitos;
  `instagram` sin @.
- **`foto`, `instagram`, `textos` y `demo` son opcionales** (`textos` por defecto:
  "profesional"/"cita"; `demo` por defecto: false).
- **El `slug` del JSON debe coincidir con el nombre del archivo.** El slug de la URL se valida con
  regex antes de leer el disco (evita rutas como `../`).
- **Fotos de Don Carlos como SVG con iniciales** (`/tenants/don-carlos/*.svg`) en lugar de `.jpg`:
  las instrucciones piden no usar imágenes con derechos. Un prospecto real puede cambiarlas.
- **`nuevo-negocio` genera un `logo.svg` provisional** (círculo con iniciales) para que el negocio
  nuevo se vea completo desde el primer momento, y no sobrescribe un negocio existente.
- **`tsx` para los scripts** (importa módulos TypeScript con alias sin compilar).
- **`outputFileTracingIncludes` para `tenants/**/*.json`**: se leen con `fs`, y sin esto no viajan
  al despliegue de Vercel.
- **Se añadió `npm run validar-tenants`** (no estaba pedido): revisa todos los JSON de una vez.
- Los tenants se leen del disco en cada petición (son archivos pequeños); sin caché por ahora.

## Fase 2

- **La restricción vive en SQL, no en Drizzle.** Drizzle no sabe declarar `EXCLUDE USING gist`; está en
  `drizzle/0001_exclusion_traslapes.sql` (migración personalizada, junto con
  `CREATE EXTENSION btree_gist`). `drizzle-kit migrate` la aplica igual que las demás.
- **Rango semiabierto `[inicio, fin)`**: una cita que termina a las 10:00 y otra que empieza a las
  10:00 no se traslapan. Las citas `completada` y `no_asistio` siguen ocupando el horario; solo
  `cancelada` lo libera. Reactivar una cancelada cuyo horario ya se tomó también se rechaza.
- **Los bloqueos no tienen restricción en la base.** Una exclusión no puede cruzar dos tablas, así que
  "reserva vs bloqueo" se valida en el servidor (motor de disponibilidad, Fase 3 y 7).
- **`bookings.professional_id` es obligatorio.** Para "cualquiera" el motor asigna un profesional
  concreto antes de insertar; así la restricción siempre aplica.
- **Columna extra `reminder_sent_at`** en `bookings` para marcar recordatorios enviados (Fase 7).
- **`status` y `source` como enums de Postgres**, más `CHECK (ends_at > starts_at)` en ambas tablas.
- **`neon-http`** (HTTP sin estado) como driver: encaja con funciones serverless de Vercel. No admite
  transacciones interactivas; se usan sentencias únicas o `db.batch`.
- **Pruebas con PGlite** (Postgres real compilado a WASM, con `btree_gist`) aplicando las mismas
  migraciones de `drizzle/`: corren sin cuenta ni red. Verificado que fallan si se quita la
  restricción. Contra Neon se comprueba con `npm run db:migrate`.
- La IP para el límite de reservas (Fase 5) no se guarda aún; se añadirá con su migración cuando haga falta.
- `getDb()` crea la conexión al primer uso, para que `next build` no exija `DATABASE_URL`.

## Neon (conexión de la Fase 2)

- **Proyecto Neon enlazado con `neon init` / `neon deploy`**: crea `neon.ts` (sin servicios extra: solo
  Postgres; `auth: false`) y escribe `DATABASE_URL`, `DATABASE_URL_UNPOOLED` y `NEON_BRANCH` en
  `.env.local` (ignorado por git). Rama `production`, región `aws-us-east-1`.
- **Driver `@neondatabase/serverless` por HTTP con la URL con pooler** (`DATABASE_URL`) para la app;
  **conexión directa** (`DATABASE_URL_UNPOOLED`) para las migraciones de `drizzle-kit`.
- **Solo Postgres.** No se activaron Auth, Storage, Functions ni AI Gateway: no se necesitan y el
  proyecto debe seguir en plan gratuito.
- **`GET /api/salud`** consulta la base y responde 200/503; sirve para verificar el despliegue.
- **`npm run db:verificar`** prueba contra la base real que existe la restricción, que rechaza un
  traslape y que acepta una cita contigua; borra lo que crea.

## Fase 3

- **`calcularHorarios` es una función pura**: recibe todo (negocio, servicio, reservas, bloqueos, `ahora`)
  y no toca la base ni el reloj. `fecha` es un `YYYY-MM-DD` del calendario de Bogotá; las reservas
  y bloqueos llegan como `Date` (UTC). Quien la llame debe pasar solo los datos de ese negocio.
- **Ventana de `diasReservables`**: son N días de calendario contando hoy (14 = hoy y los 13
  siguientes). Hoy sigue siendo reservable con los horarios que queden después de la anticipación.
- **Anticipación mínima inclusiva**: con 2 h y "ahora" 09:30, el 11:30 exacto sí se ofrece.
- **Rejilla de inicios** desde la hora de apertura, cada `intervaloMin`; un inicio vale solo si el
  servicio termina a más tardar al cierre.
- **Traslape semiabierto `[inicio, fin)`**, igual que la restricción de la base de datos: terminar
  justo cuando empieza otra cita es válido.
- **"Cualquiera"**: se consideran solo los profesionales que hacen ese servicio. Cada hora aparece una
  vez; se asigna al profesional libre con **menos minutos reservados ese día** (los empates los gana
  el que aparece primero en el JSON). La carga se calcula con las reservas del día, no con las
  asignaciones de otros horarios de la misma consulta.
- **Al reservar (Fase 5) el servidor vuelve a calcular** y usa el `profesionalId` devuelto: así la
  asignación nunca depende de lo que haya mostrado el cliente.
- **Extras no pedidos** que la interfaz necesita: `diasDisponibles` (fechas del carrusel sin días
  cerrados), `hoyEnBogota`, `sumarDias`, `diaDeSemana`.
- **Fecha imposible o mal formada lanza error** (p. ej. `2030-02-31`); no devuelve lista vacía, para
  no esconder errores del llamador.
- **Pruebas independientes de la zona del servidor**: pasan con `TZ=UTC`, `Asia/Tokyo` y
  `America/Los_Angeles` además de Bogotá (Vercel corre en UTC). Se verificó con mutaciones que
  fallan si se rompe una regla (anticipación, contiguos, cierre, canceladas, menos ocupado, UTC).
