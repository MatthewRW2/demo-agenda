-- Evita dobles reservas en la base de datos, no solo en el código.
-- Dos reservas activas (cualquier estado distinto de 'cancelada') del mismo profesional en el
-- mismo negocio no pueden solaparse. El rango es [inicio, fin): una cita que termina a las 10:00
-- y otra que empieza a las 10:00 NO se consideran traslape.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_sin_traslape"
  EXCLUDE USING gist (
    "tenant_slug" WITH =,
    "professional_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  )
  WHERE ("status" <> 'cancelada');
