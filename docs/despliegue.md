# Despliegue gratuito: GitHub + Neon + Vercel

Todo esto usa planes gratuitos. **El plan Hobby de Vercel es para uso personal y no comercial**: sirve para
mostrar la demo; cuando un cliente pague, su sistema va en su propia cuenta o en un plan adecuado (verifica los
términos vigentes de Vercel).

## Dónde estás hoy

| Paso | Estado |
| --- | --- |
| 1. Repositorio en GitHub | Hecho: https://github.com/MatthewRW2/demo-agenda (rama `main`) |
| 2. Proyecto en Neon | Hecho: región `aws-us-east-1`, rama `production`, migraciones aplicadas |
| 3. Importar en Vercel y variables | **Pendiente (lo haces tú, necesita tu cuenta de Vercel)** |
| 4. Migraciones y seed | Migraciones ya aplicadas; falta confirmarlo y sembrar la demo |
| 5. Cron | Ya está en `vercel.json`; se activa solo al desplegar |
| 6. Verificación | `npm run verificar-despliegue` + lista para el celular (abajo) |

Hay una sola base de datos hoy (rama `production` de Neon) y tu `.env.local` apunta a ella. Ver
[la recomendación de separar desarrollo y producción](#recomendado-una-rama-de-neon-para-desarrollo).

---

## 1. Repositorio en GitHub

Ya está hecho. Para subir cambios futuros:

```bash
git add -A
git commit -m "Describe el cambio"
git push
```

Vercel desplegará solo cada `push` a `main`.

## 2. Proyecto en Neon

Ya está hecho. Datos del proyecto:

- Proyecto `withered-thunder-47821604`, organización `org-red-moon-05089688`.
- Región `aws-us-east-1` (Virginia), la de tu proyecto. Es la misma zona donde Vercel ejecuta las funciones
  (`iad1`, fijado en `vercel.json`), así que la base y la app quedan pegadas y cada consulta es rápida. (No se
  comparó con otras regiones de Neon desde Colombia; si más adelante quieres afinar la latencia, mídela.)
- Solo Postgres. El plan gratuito de Neon apaga el cómputo cuando no se usa y lo vuelve a encender solo; la
  primera visita tras un rato de inactividad puede tardar un segundo más.

Para ver la cadena de conexión sin copiarla a mano del panel:

```bash
neon env pull --branch production --file .env.production.local
```

Eso crea `.env.production.local` (git lo ignora) con `DATABASE_URL` (con pooler) y `DATABASE_URL_UNPOOLED`.
**Borra ese archivo cuando termines el paso 3.**

## 3. Importar en Vercel y desplegar

1. Entra a https://vercel.com/new con tu cuenta de GitHub (`MatthewRW2`) y autoriza el acceso al repositorio
   `demo-agenda` si te lo pide (funciona también si el repositorio es privado).
2. Elige **Import** en `demo-agenda`. Vercel detecta **Next.js** solo; deja el directorio raíz (`./`) y los
   comandos de compilación por defecto.
3. Abre **Environment Variables** y agrega estas (marca **Production** y **Preview**):

   | Variable | Valor | Notas |
   | --- | --- | --- |
   | `DATABASE_URL` | la de `.env.production.local` (la que dice `-pooler`) | Obligatoria. Es un secreto: no la compartas |
   | `ADMIN_PASSWORD` | la clave del panel | En los negocios con `"demo": true` se muestra en la pantalla de acceso, así que usa una clave sin valor (por ejemplo `demo1234`) |
   | `CRON_SECRET` | un secreto nuevo y distinto al local | Genéralo con `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` |
   | `APP_URL` | la dirección pública, sin barra final | Se conoce tras el primer despliegue (ver abajo). Sin ella se usa el dominio de producción de Vercel |
   | `RESEND_API_KEY` | opcional | Sin ella no se envían correos y nada falla |
   | `RESEND_FROM` | opcional | Ej. `Reservas <hola@tudominio.com>` (el remitente de pruebas solo entrega al dueño de la cuenta de Resend) |

   No hace falta `DATABASE_URL_UNPOOLED` en Vercel: solo la usan las migraciones, que corres desde tu computador.

4. Pulsa **Deploy**. Tarda ~1 minuto. Al terminar verás la dirección, algo como
   `https://demo-agenda-xxxx.vercel.app`.
5. **Fija la dirección pública** para que la vista previa del link funcione: en
   *Settings → Environment Variables* crea `APP_URL` con esa dirección (sin `/` al final) y haz
   *Deployments → ⋯ → Redeploy*. Si luego conectas un dominio propio, cambia `APP_URL` por él.
6. En *Settings → Deployment Protection* comprueba que el dominio de **producción** sea público: ábrelo en
   una ventana de incógnito. Si te pide iniciar sesión en Vercel, el link no servirá para tus prospectos.

Alternativa por consola (si prefieres): `npm i -g vercel`, `vercel login`, `vercel link`,
`vercel env add DATABASE_URL production` (repite por variable) y `vercel --prod`.

## 4. Migraciones y seed contra producción

Desde tu computador, con `DATABASE_URL_UNPOOLED` apuntando a la base de producción (hoy es tu `.env.local`):

```bash
npm run db:migrate        # idempotente: si ya está todo aplicado, no hace nada
npm run db:verificar      # crea y borra una reserva de prueba y comprueba la restricción anti-traslape
npm run seed -- don-carlos   # ~60 citas de ejemplo (BORRA las citas y bloqueos actuales de don-carlos)
```

Si algún día usas una base nueva y vacía, `npm run db:migrate` crea todas las tablas, la extensión
`btree_gist` y la restricción que impide dobles reservas.

## 5. Cron diario

Ya está en `vercel.json` (`0 9 * * *` = 09:00 UTC = 04:00 en Bogotá). Al desplegar, Vercel lo registra:

- Compruébalo en *Project → Settings → Cron Jobs*.
- Vercel envía `Authorization: Bearer <CRON_SECRET>` automáticamente, usando la variable `CRON_SECRET` del
  proyecto. Sin esa variable, el cron responde 401 y la demo no se restablece sola.
- En el plan Hobby los crons corren **una vez al día** y pueden retrasarse dentro de esa hora; para una demo basta.
- Para probarlo a mano (¡reemplaza los datos de la demo!):

  ```bash
  curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU-APP.vercel.app/api/cron/restablecer-demo
  ```

  Debe responder `{"ok":true,"negocios":[{"slug":"don-carlos","reservas":60,"bloqueos":2}]}`.
  Solo restablece negocios con `"demo": true`; los negocios reales no se tocan.

## 6. Verificar

### Automático

```bash
npm run verificar-despliegue -- https://TU-APP.vercel.app
```

Comprueba, sin modificar datos: la raíz redirige a `/don-carlos`; el sitio responde; las etiquetas de vista
previa existen y la imagen es absoluta, está en tu dominio y se descarga; `/api/salud` confirma que la base
contesta; `/reservar` carga; el panel pide contraseña y no se indexa; los enlaces inventados dan 404; y el cron
rechaza peticiones sin secreto. Si algo falla, el mensaje dice qué variable revisar.

### En un celular real (con datos móviles, no con tu wifi)

Marca cada punto en tu teléfono:

- [ ] Abre `https://TU-APP.vercel.app` (debe llevarte a Barbería Don Carlos) y se ve bien, sin cortes a los lados.
- [ ] **Reserva** de punta a punta: servicio → barbero → día → hora → datos → confirmación.
- [ ] En la confirmación, **"Confirmar por WhatsApp"** abre WhatsApp con el mensaje ya escrito.
- [ ] **"Agregar a Google Calendar"** abre el evento con la hora correcta (hora de Bogotá).
- [ ] Abre el enlace de la cita desde otro navegador: se ve, y puedes **cambiar la hora** y **cancelar**.
- [ ] **Panel** en `/don-carlos/admin`: la pantalla de acceso muestra la contraseña de la demo; entras; ves la
      agenda con citas; abres una cita y cambias su estado; creas una cita manual; bloqueas un horario.
- [ ] **Recordatorios**: "Enviar recordatorio" abre WhatsApp con el mensaje para el cliente y la fila queda
      marcada como enviada. (Los celulares de la demo son ficticios: **no pulses "enviar" en WhatsApp**.)
- [ ] **Vista previa del link en WhatsApp**: pega `https://TU-APP.vercel.app/don-carlos` en un chat contigo
      mismo ("Mensajes guardados" o un contacto de prueba) y comprueba que aparece la tarjeta con el logo, el
      nombre del negocio y la dirección. WhatsApp guarda la vista previa en caché: si no aparece o sale una
      versión vieja, agrega `?v=2` al final del link, o pídele al depurador de enlaces de Facebook
      (https://developers.facebook.com/tools/debug/) que la vuelva a leer.
- [ ] Toca **"Restablecer demo"** en el panel (pide confirmación) y vuelve a ver la agenda con datos nuevos.

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| `/api/salud` responde 503 | `DATABASE_URL` mal copiada o falta en Vercel | Revisa que sea la cadena **con `-pooler`**, sin comillas; redespliega |
| El panel dice "Panel no disponible" | Falta `ADMIN_PASSWORD` en Vercel | Agrégala y redespliega |
| La vista previa no sale o la imagen apunta a `localhost` | Falta `APP_URL` | Defínela con la dirección pública y redespliega; luego `?v=2` |
| El cron responde 401 | Falta `CRON_SECRET` en Vercel | Agrégala y redespliega |
| Un negocio nuevo da 404 en producción | Se creó el JSON pero no se subió | `git add -A && git commit && git push` (los negocios se leen al compilar) |
| La primera visita tarda ~1 s extra | Neon despertando del reposo gratuito | Es normal; las siguientes son rápidas |
| El build falla | Revisa el registro en Vercel | `npm run lint`, `npm run typecheck` y `npm run build` deben pasar en tu computador |

---

## Recomendado: una rama de Neon para desarrollo

Hoy tu computador y Vercel usarían **la misma base**. Las pruebas de Playwright (`npm run test:e2e`) crean y
borran citas "E2E…" y **vuelven a sembrar `don-carlos`**: si las corres mientras un prospecto prueba la demo en
producción, verá cambiar los datos. Para separar los entornos con una rama de Neon:

```bash
neon checkout dev --create     # crea la rama "dev" y apunta .env.local a ella
npm run db:migrate             # le aplica las migraciones
npm run seed -- don-carlos     # y datos de ejemplo
```

Cosas a saber:

- `neon checkout` **reescribe `DATABASE_URL` y `DATABASE_URL_UNPOOLED` en `.env.local`** para que apunten a la
  rama; el resto de variables se conserva. Para volver a producción: `neon checkout production`.
- Según `neon.ts`, las ramas nuevas **expiran a los 7 días** (`ttl: "7d"`). Si quieres que `dev` dure,
  cambia o quita ese valor en `neon.ts`, o vuelve a crearla cuando haga falta.
- Vercel sigue usando la `DATABASE_URL` de `production` que pusiste en el paso 3: no se ve afectado.
