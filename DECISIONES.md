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
