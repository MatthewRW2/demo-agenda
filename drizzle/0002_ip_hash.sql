ALTER TABLE "bookings" ADD COLUMN "customer_ip_hash" text;--> statement-breakpoint
CREATE INDEX "bookings_ip_creada_idx" ON "bookings" USING btree ("customer_ip_hash","created_at");