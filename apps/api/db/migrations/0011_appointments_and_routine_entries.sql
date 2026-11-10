CREATE TYPE "public"."appointment_recurrence" AS ENUM('none', 'weekly');--> statement-breakpoint
CREATE TABLE "appointment_cancelled_occurrences" (
	"institution_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"occurrence_date" date NOT NULL,
	"cancelled_by_user_id" uuid NOT NULL,
	"cancelled_at" timestamp with time zone NOT NULL,
	CONSTRAINT "appointment_cancelled_occurrences_appointment_id_occurrence_date_pk" PRIMARY KEY("appointment_id","occurrence_date")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"professional_user_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"starts_at" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"notes" text,
	"recurrence" "appointment_recurrence" NOT NULL,
	"recurrence_until" date,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "appointments_duration" CHECK ("appointments"."duration_minutes" between 5 and 480),
	CONSTRAINT "appointments_same_day" CHECK (extract(epoch from "appointments"."starts_at") / 60 + "appointments"."duration_minutes" <= 1440),
	CONSTRAINT "appointments_notes_length" CHECK ("appointments"."notes" is null or char_length("appointments"."notes") between 1 and 1000),
	CONSTRAINT "appointments_recurrence_until" CHECK (("appointments"."recurrence" = 'weekly' or "appointments"."recurrence_until" is null) and ("appointments"."recurrence_until" is null or "appointments"."recurrence_until" >= "appointments"."starts_on"))
);
--> statement-breakpoint
CREATE TABLE "routine_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"routine_block_id" uuid NOT NULL,
	"occurs_on" date NOT NULL,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "routine_entries_block_day" UNIQUE("routine_block_id","occurs_on"),
	CONSTRAINT "routine_entries_notes_length" CHECK ("routine_entries"."notes" is null or char_length("routine_entries"."notes") between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "routine_entry_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "routine_entry_photos_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "routine_entry_photos_media_type" CHECK ("routine_entry_photos"."media_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "routine_entry_photos_byte_size" CHECK ("routine_entry_photos"."byte_size" between 1 and 2000000)
);
--> statement-breakpoint
ALTER TABLE "appointment_cancelled_occurrences" ADD CONSTRAINT "appointment_cancelled_occurrences_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_cancelled_occurrences" ADD CONSTRAINT "appointment_cancelled_occurrences_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_professional_user_id_users_id_fk" FOREIGN KEY ("professional_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_student_id_institution_id_students_id_institution_id_fk" FOREIGN KEY ("student_id","institution_id") REFERENCES "public"."students"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_routine_block_id_routine_blocks_id_fk" FOREIGN KEY ("routine_block_id") REFERENCES "public"."routine_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_student_id_institution_id_students_id_institution_id_fk" FOREIGN KEY ("student_id","institution_id") REFERENCES "public"."students"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entry_photos" ADD CONSTRAINT "routine_entry_photos_entry_id_routine_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."routine_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entry_photos" ADD CONSTRAINT "routine_entry_photos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_student_starts_on" ON "appointments" USING btree ("student_id","starts_on");--> statement-breakpoint
CREATE INDEX "appointments_institution_starts_on" ON "appointments" USING btree ("institution_id","starts_on");--> statement-breakpoint
CREATE INDEX "routine_entries_student_occurs_on" ON "routine_entries" USING btree ("student_id","occurs_on");--> statement-breakpoint
CREATE INDEX "routine_entry_photos_entry" ON "routine_entry_photos" USING btree ("entry_id","created_at");--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "appointments_tenant_isolation" ON "appointments"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "appointment_cancelled_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointment_cancelled_occurrences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "appointment_cancelled_occurrences_tenant_isolation" ON "appointment_cancelled_occurrences"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "routine_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_entries" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "routine_entries_tenant_isolation" ON "routine_entries"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "routine_entry_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_entry_photos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "routine_entry_photos_tenant_isolation" ON "routine_entry_photos"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
INSERT INTO "permissions" ("key", "sensitive") VALUES ('appointment.read', false), ('appointment.write', false), ('routine.entry.write', false) ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Mesmo motivo da 0009: papéis já provisionados não passam de novo pelo seed de templates.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("institution_id", "role_id", "permission_key", "scope")
  SELECT "roles"."institution_id", "roles"."id", "grants"."permission_key", "grants"."scope"::"permission_scope"
  FROM "roles"
  JOIN (VALUES
    ('student', 'appointment.read', 'own'),
    ('student', 'routine.entry.write', 'own'),
    ('guardian', 'appointment.read', 'own'),
    ('care-assigned', 'appointment.read', 'assigned'),
    ('care-assigned', 'appointment.write', 'assigned'),
    ('care-institution', 'appointment.read', 'institution'),
    ('care-institution', 'appointment.write', 'institution')
  ) AS "grants" ("template_key", "permission_key", "scope") ON "grants"."template_key" = "roles"."template_key"
  WHERE "roles"."is_system"
  ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
