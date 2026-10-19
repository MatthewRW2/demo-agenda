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
