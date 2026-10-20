# Crear la demo de un prospecto (objetivo: menos de 20 minutos)

Una demo nueva es **un archivo JSON** más un logo. No se toca código. Ejemplo real hecho con este mismo
proceso: `tenants/clinica-sonrisa.json` (un consultorio odontológico, con `"profesional": "odontólogo"`).

## Presupuesto de tiempo

| Tiempo | Paso | Quién hace el trabajo |
| --- | --- | --- |
| 1 min | Crear el negocio (comando) | automático |
| 5–8 min | Reunir los datos del prospecto (su Instagram o ficha de Google) | tú |
| 3–5 min | Pasarlos al JSON y cambiar el logo | tú (o Claude, ver más abajo) |
| 1 min | Validar y mirar en tu computador | automático + tu vista |
| 2 min | Sembrar datos, subir y esperar el despliegue (~1 min) | automático |
| 2–3 min | Revisar en el celular y enviarle el link | tú |

Los pasos automáticos tardan segundos. **El tiempo real depende de qué tan rápido encuentres los datos del
prospecto**; las cifras de arriba son una estimación, no una medición.

## Paso a paso

```bash
# 1. Crear el negocio desde la plantilla (slug en minúsculas con guiones; nombre entre comillas)
npm run nuevo-negocio -- clinica-sonrisa "Clínica Dental Sonrisa"

# 2. Editar tenants/clinica-sonrisa.json (ver la tabla de campos) y poner el logo del prospecto
#    en public/tenants/clinica-sonrisa/ (reemplaza logo.svg, o usa .png/.jpg y cambia "logo" en el JSON)

# 3. Validar. Con --estricto también falla si quedan valores de relleno de la plantilla
npm run validar-tenants -- --estricto

# 4. Mirarlo en tu computador
npm run dev          # http://localhost:3000/clinica-sonrisa

# 5. Datos de ejemplo para que el panel se vea vivo (BORRA las citas actuales de ese negocio)
npm run seed -- clinica-sonrisa

# 6. Publicar
git add -A
git commit -m "Demo: Clínica Dental Sonrisa"
git push             # Vercel despliega en ~1 minuto
```

Notas:

- El paso 5 siembra la base a la que apunta tu `.env.local` (hoy, la misma de producción). Si no lo corres, el
  negocio aparece **sin citas** hasta que el cron diario (04:00 en Bogotá) lo siembre solo, o hasta que alguien
  pulse **Restablecer demo** en su panel. El cron restablece todos los negocios con `"demo": true`.
- El link para el prospecto es `https://TU-APP.vercel.app/clinica-sonrisa` y su panel `/clinica-sonrisa/admin`.

## Qué poner en cada campo

| Campo | De dónde sacarlo | Formato y notas |
| --- | --- | --- |
| `slug` | Lo eliges | Minúsculas, números y guiones (`clinica-sonrisa`). Es la dirección. Debe coincidir con el nombre del archivo. No uses `api` |
| `nombre`, `eslogan` | Su Instagram o ficha de Google | Una frase corta de eslogan |
| `logo` | Su foto de perfil de Instagram o su logo | Ruta dentro de `public/` (`/tenants/<slug>/logo.png`). SVG, PNG o JPG. Si no tienes uno, se queda el provisional con iniciales |
| `imagenPortada` | Opcional. Una foto del local (Unsplash o Pexels, o la suya) | Ruta dentro de `public/` (`/tenants/<slug>/portada.jpg`), horizontal, ~1920×1280, idealmente bajo 250 KB. Sin ella la portada es un campo liso del color primario con el logo grande. Anota el crédito en `docs/creditos-imagenes.md` |
| `colores.primario` | Un color de su logo | Cualquiera: la portada y las capas se tiñen con él, y el texto, los bordes y los fondos suaves se derivan solos con contraste garantizado (también con colores claros) |
| `colores.acento` | Otro color de su logo | Fondo de los botones; el color del texto encima se elige solo para que contraste |
| `resenas` | Opcional. Reseñas reales de sus clientes | Hasta 6, cada una con `autor`, `texto`, `estrellas` (1–5, por defecto 5) y `fuente` opcional. Sin reseñas: en una demo (`"demo": true`) salen tres de ejemplo rotuladas como inventadas; en un negocio real la sección no aparece |
| `whatsapp` | Su ficha de Google o su Instagram | `57` + 10 dígitos, sin `+` ni espacios: `573102345678`. **En una demo (`"demo": true`) nunca se usa**: los botones de WhatsApp llevan a `contactoDemo` (abajo) |
| `direccion` | Su ficha de Google | Se usa también para el mapa |
| `instagram` | Su perfil | Solo el usuario, sin `@` ni URL. Bórralo si no tiene. **En una demo tampoco se usa** (solo el de `contactoDemo`): no pongas el de un negocio real en una demo |
| `contactoDemo` | **Tu** contacto, para las demos | `{ "nombre": "Mateo", "whatsapp": "57…", "instagram": "tu_usuario" }`; `nombre` e `instagram` son opcionales. Con `"demo": true`, los botones de WhatsApp abren `wa.me/<tu número>` con "Hola Mateo, vi la demo de {negocio} y quiero una para mi negocio", y el Instagram es el tuyo. Sin él, esos botones no aparecen (y `validar-tenants` avisa). Cópialo de otra demo; con `"demo": false` se ignora |
| `horario` | Su ficha de Google | `["08:00", "18:00"]` por día en formato 24 horas; `null` si cierra. Los siete días son obligatorios |
| `intervaloMin` | Cada cuánto empiezan las citas | 15 o 30 casi siempre |
| `anticipacionMinHoras` | Cuánto aviso necesita | Aplica a reservar, cancelar y cambiar |
| `diasReservables` | Hasta cuántos días adelante se reserva | 14 es un buen punto de partida |
| `servicios` | Su lista de precios (Instagram, carta, ficha) | `id` en minúsculas con guiones; `duracionMin` entero; `precio` en pesos, entero (`25000`) |
| `profesionales` | Su equipo | `servicios` = los `id` que hace cada uno. `foto` es opcional: retrato vertical (~800×1000, `/tenants/<slug>/<id>.jpg`); sin foto se muestra un campo del color primario con las iniciales |
| `textos.profesional` | Cómo se llama su equipo | `barbero`, `odontólogo`, `estilista`, `terapeuta`, `doctor`… (se pluraliza solo: "Nuestros odontólogos") |
| `textos.reserva` | Cómo llama a lo que se agenda | **Usa una palabra femenina**: `cita`, `consulta`, `sesión`, `reserva`. Los mensajes están escritos en femenino ("tu cita quedó confirmada") y `validar-tenants` avisa si pones algo como `turno` |
| `demo` | — | `true` mientras es una demo: muestra la franja "Demo con datos ficticios", muestra la contraseña del panel y habilita sembrar y restablecer |

Reglas que valida el sistema (con el campo exacto que falla): cada servicio debe tener al menos un profesional
que lo haga; los `id` no se repiten; la apertura va antes del cierre; y el negocio debe abrir al menos un día.

## Pedirle a Claude que arme el JSON

Pega esto en un chat junto con lo que copiaste del Instagram o de Google (bio, horario, lista de precios, equipo):

> Con estos datos de un negocio, rellena el archivo `tenants/<slug>.json` siguiendo el formato de
> `tenants/_plantilla.json`. WhatsApp con el prefijo 57 y sin símbolos; precios en pesos como números enteros;
> `id` de servicios y profesionales en minúsculas con guiones; horarios en 24 horas con `null` los días que
> cierra; `textos.reserva` en femenino (cita, consulta o sesión). Si falta un dato, déjalo con el valor de la
> plantilla y dímelo. Luego corre `npm run validar-tenants -- --estricto` y corrige lo que avise.

## Antes de enviar el link

- [ ] `npm run validar-tenants -- --estricto` sin errores ni avisos.
- [ ] El logo es el del prospecto (no el provisional), se ve nítido y no se corta (se muestra en círculo).
- [ ] Hiciste una reserva de prueba en el celular y el botón de WhatsApp lleva al número correcto.
- [ ] Pegaste el link en un chat contigo mismo y la vista previa muestra su nombre y su logo.
- [ ] En el panel (`/<slug>/admin`) la contraseña se ve en la pantalla de acceso y la agenda tiene citas.

## Cuando el prospecto se convierte en cliente

La demo tiene citas ficticias y muestra la contraseña en pantalla; un cliente real no debe tener ninguna de las
dos cosas. En este orden:

```bash
npm run vaciar-demo -- clinica-sonrisa   # borra las citas y bloqueos ficticios (solo funciona con "demo": true)
# luego, en tenants/clinica-sonrisa.json:  "demo": false
git add -A && git commit -m "Clínica Sonrisa: pasa a producción" && git push
```

Con `"demo": false` desaparecen la franja y la contraseña en pantalla, y **ningún comando, botón ni cron puede
volver a tocar sus datos** (el seed, el vaciado y el restablecimiento se niegan). Importante: el panel de todos
los negocios de este despliegue comparte la misma `ADMIN_PASSWORD`, y el plan Hobby de Vercel no es para uso
comercial. Cuando el cliente pague, su sistema debe ir en **su propio despliegue**, con su propia base de datos y
contraseña (ver [despliegue.md](despliegue.md)).

## Problemas comunes

| Síntoma | Qué pasó | Solución |
| --- | --- | --- |
| `validar-tenants` marca un campo con un mensaje en rojo | El JSON tiene un valor inválido | El mensaje dice el campo exacto (por ejemplo `servicios[1].precio`) |
| `AVISO … es de la plantilla` | Quedó un valor de relleno | Cámbialo (o bórralo, en el caso del Instagram) |
| La página da 404 en producción | No se subió el JSON | `git add -A && git commit && git push`: los negocios se leen al compilar |
| El negocio sale sin citas | No se sembró | `npm run seed -- <slug>` o "Restablecer demo" en su panel |
| El logo no aparece en la vista previa del link | El archivo no está donde dice `logo` | La ruta empieza con `/` y es relativa a `public/` |
| Un servicio no deja reservar | Ningún profesional lo hace, o dura más que la jornada | `validar-tenants` lo explica |
