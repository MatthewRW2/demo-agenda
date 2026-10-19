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

## Fase 4

- **Una sola página estática por negocio** (`generateStaticParams` + `[slug]/layout.tsx`): carga
  instantánea y sin base de datos. Al añadir un negocio hay que volver a desplegar (ya es el flujo:
  editar JSON y hacer push). Un slug desconocido responde 404.
- **Marca por variables CSS**: el layout de `/[slug]` inyecta `--primario`, `--acento` y, calculados
  con la fórmula de contraste WCAG, `--sobre-primario` y `--sobre-acento` (texto negro o blanco, el
  que más contraste tenga). Así cualquier color de un prospecto deja el texto legible.
- **El color de acento nunca se usa como texto sobre blanco** (un dorado no alcanza contraste AA);
  solo como fondo de botones. El texto sobre blanco usa el color primario: si un prospecto elige un
  primario muy claro, conviene revisarlo.
- **Vista previa para WhatsApp** (`opengraph-image`): imagen 1200×630 generada al compilar con el
  logo, nombre, eslogan, dirección y colores del negocio. La URL absoluta sale de `APP_URL`, o del
  dominio de producción de Vercel (`VERCEL_PROJECT_PRODUCTION_URL`), o `localhost` en local.
- **Mapa**: iframe de Google Maps por dirección (sin API key) con `loading="lazy"`, más enlace
  "Cómo llegar".
- **Barra "Reservar" fija abajo solo en celular**, además del botón grande de la portada.
- **Plural del rol** (`textos.profesional`): "barbero" → "Nuestros barberos", "doctor" → "doctores".
  Reglas simples; si alguna palabra sale mal, se corrige en `pluralizar`.
- **Horas en formato de 12 horas** ("9:00 a. m.") como se usa en Colombia.
- **Slug `api` reservado** para que ningún negocio tape `/api/salud`.
- **Raíz `/`** redirige (307) a `/don-carlos` desde `next.config.ts`.
- **`typecheck` ahora corre `next typegen` antes de `tsc`**, para que funcione en un clon limpio.
- **Turbopack**: las lecturas con `fs` de `tenants/` llevan `turbopackIgnore` (ya se incluyen
  explícitamente con `outputFileTracingIncludes`); sin eso rastreaba todo el proyecto.
- **Medición** (Lighthouse 12, móvil, `next start` local): rendimiento 98, accesibilidad 100,
  buenas prácticas 96, SEO 100. LCP 2,3 s, CLS 0. Lo único que baja buenas prácticas es el 404 de
  `/<slug>/reservar`, que se crea en la Fase 5. Sin desbordes horizontales en 320–412 px.
- El botón "Reservar" ya enlaza a `/<slug>/reservar`; esa pantalla llega en la Fase 5.

## Fase 5

- **Server Actions** (`/[slug]/reservar/acciones.ts`) para consultar horas y reservar. Son endpoints
  públicos: todo se valida con Zod en el servidor y el slug se resuelve contra los tenants.
- **El servidor nunca confía en el cliente**: al reservar vuelve a calcular los horarios libres y usa
  el profesional que resulte (con "cualquiera", el menos ocupado). Si la hora ya no está libre, responde
  "Ese horario se acaba de ocupar, elige otro." y la pantalla vuelve a las horas, ya actualizadas.
- **Carreras**: si la restricción de la base rechaza el insert (otra persona se adelantó), se recalcula
  y se reintenta hasta 3 veces (con "cualquiera" puede haber otro profesional libre). Un error que no sea
  de traslape se propaga y se registra; al cliente le sale un mensaje genérico.
- **Lógica con la base inyectada** (`servicio.ts` + `RepoReservas`): se prueba con una base en memoria
  (simula carreras y fallos) y contra PGlite con la restricción real. La implementación Drizzle es
  `repositorio.ts` y sirve igual para Neon y PGlite.
- **Límites de protección**: citas confirmadas y futuras por celular y negocio (3; 10 en modo demo) y
  reservas por IP en una hora (10; 30 en modo demo). Los límites del modo demo son más holgados porque el
  prospecto prueba varias veces. Sin IP conocida (desarrollo local) no se aplica el límite por IP.
- **La IP se guarda solo como hash con sal** (`customer_ip_hash`, migración `0002_ip_hash`); la sal sale
  de `CRON_SECRET` o `ADMIN_PASSWORD`. Vercel entrega la IP en `x-forwarded-for`.
- **Celular colombiano**: 10 dígitos que empiezan por 3. Acepta espacios, guiones, `+57`, `57` y `0057`
  y guarda solo los 10 dígitos. Fijos no se aceptan (el recordatorio va por WhatsApp).
- **Mismas reglas en el navegador y en el servidor** (el esquema Zod es compartido): el error aparece al
  instante junto al campo y el servidor lo vuelve a comprobar.
- **Confirmación = página `/<slug>/cita/<token>`** (con `?nueva=1` muestra el "¡Listo!"). Es la misma
  URL que va por correo y que la Fase 6 ampliará con cancelar y reprogramar. Lleva `noindex` y
  `no-referrer` porque el token es secreto (32 bytes aleatorios, 43 caracteres).
- **Código de reserva** = 6 primeros caracteres del id, en mayúsculas (solo para mostrar y buscar; el
  acceso lo da el token).
- **Correo con Resend por HTTP** (`fetch`, sin SDK) y enviado con `after()`: si no hay
  `RESEND_API_KEY` se omite; si Resend falla, solo se registra. Remitente por defecto
  `onboarding@resend.dev`, que **solo entrega al dueño de la cuenta de Resend**; para escribirle a
  clientes hay que verificar un dominio y poner `RESEND_FROM`.
- **Pasos**: servicio → profesional → día y hora (en una sola pantalla) → datos. Al elegir la hora se
  avanza solo. El foco pasa al título en cada paso y hay barra de progreso accesible.
- **`/reservar` lleva `noindex`** (por eso su SEO en Lighthouse es 60, a propósito).
- **Playwright** (`npm run test:e2e`) usa el Chrome instalado en emulación de Pixel 7 y la base real
  (Neon). Todo lo que crea lleva el nombre "E2E ..." y se borra antes y después. Reserva el último día
  del carrusel para no chocar con los datos de la demo. Además de las dos pruebas pedidas hay una de
  carrera entre dos clientes, una de validación y una de enlace inválido.
- **Verificado con mutaciones**: si el servidor ignora las reservas existentes, fallan las pruebas del
  horario ocupado (e2e); si se quita el reintento, el manejo de errores o el recálculo, fallan las
  unitarias.
- **Medición** (Lighthouse móvil): `/<slug>` 98 / 100 / 100 / 100 (rendimiento, accesibilidad, buenas
  prácticas, SEO); `/<slug>/reservar` 98 / 100 / 100 / 60 (noindex).

## Fase 6

- **Qué puede hacer el cliente con su cita** (`/<slug>/cita/<token>`): ver, cancelar y cambiar día u hora.
  El token secreto es la única credencial (no hay cuentas).
- **Regla de anticipación**: solo se puede cancelar o cambiar si la cita sigue confirmada y falta **al menos
  `anticipacionMinHoras`** del negocio (la misma regla que para reservar; justo 2 h sí, un minuto menos no).
  Si falta menos, la página lo explica y ofrece WhatsApp con el código ya escrito. El nuevo horario al
  cambiar también respeta la anticipación (lo garantiza el mismo motor de disponibilidad).
- **Reprogramar conserva servicio y profesional** (lo más simple): si el profesional no tiene hueco, el
  cliente cancela y reserva de nuevo, o escribe por WhatsApp. El propio hueco actual de la cita cuenta como
  libre, así que se puede mover 15 minutos sin que choque consigo misma.
- **El servidor vuelve a calcular** el horario al mover (igual que al reservar). Si alguien tomó el hueco,
  responde "Ese horario se acaba de ocupar, elige otro." y la lista se actualiza.
- **Operaciones atómicas**: cancelar y mover llevan la condición `status = 'confirmada'` dentro del propio
  `UPDATE`; dos pestañas a la vez no se pisan y una cita cancelada no puede reactivarse moviéndola.
- **Mover borra `reminder_sent_at`**: el recordatorio de la Fase 7 debe volver a enviarse para la nueva hora.
- **Cancelar pide confirmación** ("¿Seguro?") y arrepentirse no cambia nada. Mover también pide un
  "Confirmar cambio" explícito (elegir la hora no basta).
- **Mover al mismo horario** responde "Ya tienes tu cita en ese horario" (sin cambios).
- **Sin correo de cambio o cancelación** por ahora: no estaba pedido; se puede añadir con la misma
  plantilla.
- **Páginas de citas pasadas**: una cita confirmada cuya hora ya pasó muestra "ya pasó" y ninguna acción.
- **Accesibilidad**: el foco pasa al título de cada panel; los títulos enfocados por código no dibujan
  anillo (`[tabindex="-1"]`), los controles sí.
- **Pruebas**: 31 unitarias nuevas contra Postgres real (PGlite) y 5 de Playwright (cancelar, cambiar,
  carrera al cambiar, cita demasiado cercana, token inválido). Verificado con mutaciones (propia cita no
  excluida, anticipación ignorada, estado sin condición en cancelar/mover, horario no validado).
- Hallazgos corregidos al probar: tras un cambio exitoso el panel quedaba abierto con datos viejos (la página
  no se desmonta al navegar); y las pruebas se pisaban entre sí al leer filas (ahora cada una empieza con la
  base limpia y consulta por su nombre).

## Fase 7

- **Acceso**: una sola `ADMIN_PASSWORD` para todos los negocios (como pide el documento) y una cookie por
  negocio (`admin_<slug>`): `httpOnly`, `SameSite=Lax`, `Secure` en producción, ruta `/<slug>/admin` y 7 días
  de vigencia. La cookie es `<carga>.<HMAC-SHA256>`; la carga lleva el slug y la expiración, así que una
  cookie de un negocio no sirve en otro. La clave de firma se deriva de la contraseña: **cambiar
  `ADMIN_PASSWORD` cierra todas las sesiones**. No hace falta otra variable de entorno.
- **Falla cerrada**: si `ADMIN_PASSWORD` no está definida, el panel muestra "Panel no disponible" y nadie
  entra (una contraseña vacía nunca es válida).
- **La sesión se comprueba en cada página y en cada acción del servidor**, no en el layout: las acciones son
  endpoints públicos y un layout no las protege. Verificado con mutaciones (acciones sin comprobar sesión
  y páginas siempre abiertas hacen fallar las pruebas).
- **Contraseña**: comparación en tiempo constante y una demora fija de 0,7 s tras un intento fallido. **No hay
  bloqueo por intentos** (en serverless un contador en memoria no es fiable y no se añadió tabla para esto):
  en producción conviene una contraseña larga. Pendiente si se quiere endurecer.
- **Modo demo**: si el negocio tiene `"demo": true`, la pantalla de acceso muestra la contraseña. Un negocio
  real (`"demo": false`) nunca la muestra.
- **Aislamiento entre negocios**: toda operación del panel filtra por `tenant_slug` en el propio SQL; con un
  id de otro negocio no se lee ni se toca nada (probado). Los ids deben ser UUID válidos antes de llegar a la base.
- **Agenda del día**: una columna por profesional, escala 1,4 px por minuto (30 min = 42 px). La franja
  visible es el horario del local, ampliada si hay citas o bloqueos fuera de él. En el celular la tabla se
  desliza de lado (con una pista escrita). Las **canceladas no se dibujan** (liberan el hueco y podrían
  solaparse con otra cita) y se cuentan debajo.
- **Semana como lista por día** (no como cuadrícula): se lee mejor en el celular y cada cita abre su detalle.
- **Detalle de cita por URL** (`?cita=<id>`): se puede compartir y funciona sin JavaScript para abrirlo.
- **Cualquier estado puede pasar a cualquier otro** (incluido volver de cancelada a confirmada). Si el hueco ya
  lo ocupó otra cita, la restricción de la base lo impide y se avisa en vez de fallar.
- **Cita manual**: ignora la anticipación mínima y la ventana de días (se calcula "desde el inicio de ese día"),
  así se registra a quien ya está en la silla, también horas de hoy que ya pasaron o días pasados. Sigue
  respetando horario del local, rejilla, bloqueos y traslapes. **El celular es opcional** (se guarda vacío); el
  recordatorio de esa cita dice "Sin celular". Origen `admin`.
- **Bloqueos**: de un profesional o de todo el local, con motivo. Si caen sobre citas confirmadas **no las
  cancelan**: se avisa cuántas hay. Se pueden quitar desde la agenda.
- **Recordatorios**: citas confirmadas de mañana (calendario de Bogotá). El botón es un enlace `wa.me` con el
  mensaje escrito (incluye el enlace para cambiar o cancelar); al pulsarlo se marca `reminder_sent_at` y la
  fila queda "✓ Recordatorio enviado" (se puede reenviar). Cambiar la cita de hora borra la marca.
- **Métricas** (semana de lunes a domingo, Bogotá): _citas_ = no canceladas; _inasistencias %_ = no asistió ÷
  (completadas + no asistió), con un decimal, y "—" si aún no hay ninguna resuelta; _ingresos estimados_ =
  precio de lista de las confirmadas y completadas (no cuentan inasistencias ni canceladas); _servicio más
  pedido_ y _hora más ocupada_ sobre las no canceladas, con desempate por el orden del JSON y por la hora más
  temprana.
- **Pruebas**: 10 de sesión, 21 de agenda/métricas, 24 de operaciones contra Postgres real y 14 de Playwright
  (acceso con cookie `httpOnly`, sesión vencida, agenda, estados, cita manual, bloqueo con efecto real en el
  flujo público, recordatorio con WhatsApp interceptado, métricas con cifras exactas).
- Hallazgo al probar: una mutación mostró que el "override" de reglas del panel no estaba cubierto (con una
  anticipación grande del negocio, la agenda interna quedaba bloqueada); se añadió la prueba.
