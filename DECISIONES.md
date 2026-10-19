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
