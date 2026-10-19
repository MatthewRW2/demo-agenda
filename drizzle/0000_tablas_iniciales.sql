CREATE TYPE "public"."estado_reserva" AS ENUM('confirmada', 'completada', 'no_asistio', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."origen_reserva" AS ENUM('web', 'admin');--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"professional_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_rango_valido" CHECK ("blocks"."ends_at" > "blocks"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"service_id" text NOT NULL,
	"professional_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"status" "estado_reserva" DEFAULT 'confirmada' NOT NULL,
	"manage_token" text NOT NULL,
	"source" "origen_reserva" DEFAULT 'web' NOT NULL,
	"notes" text,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_manage_token_unique" UNIQUE("manage_token"),
	CONSTRAINT "bookings_rango_valido" CHECK ("bookings"."ends_at" > "bookings"."starts_at")
);
--> statement-breakpoint
CREATE INDEX "blocks_tenant_inicio_idx" ON "blocks" USING btree ("tenant_slug","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_tenant_inicio_idx" ON "bookings" USING btree ("tenant_slug","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_tenant_telefono_idx" ON "bookings" USING btree ("tenant_slug","customer_phone");