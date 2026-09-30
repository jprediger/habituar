CREATE TYPE "public"."student_condition" AS ENUM('adhd', 'autism', 'intellectual-disability', 'learning-disorder', 'physical-disability', 'visual-impairment', 'hearing-impairment', 'other');--> statement-breakpoint
CREATE TABLE "student_consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"professional_user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"notes" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "student_consultations_duration" CHECK ("student_consultations"."duration_minutes" between 1 and 480),
	CONSTRAINT "student_consultations_notes_length" CHECK (char_length("student_consultations"."notes") between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "student_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "student_observations_body_length" CHECK (char_length("student_observations"."body") between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "student_profile_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"school_grade" text,
	"conditions" "student_condition"[] DEFAULT '{}' NOT NULL,
	"support_needs" text,
	"recorded_by_user_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "student_profile_revisions_student_revision_number" UNIQUE("student_id","revision_number")
);
--> statement-breakpoint
ALTER TABLE "student_consultations" ADD CONSTRAINT "student_consultations_professional_user_id_users_id_fk" FOREIGN KEY ("professional_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_consultations" ADD CONSTRAINT "student_consultations_student_id_institution_id_students_id_institution_id_fk" FOREIGN KEY ("student_id","institution_id") REFERENCES "public"."students"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_observations" ADD CONSTRAINT "student_observations_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_observations" ADD CONSTRAINT "student_observations_student_id_institution_id_students_id_institution_id_fk" FOREIGN KEY ("student_id","institution_id") REFERENCES "public"."students"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile_revisions" ADD CONSTRAINT "student_profile_revisions_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile_revisions" ADD CONSTRAINT "student_profile_revisions_student_id_institution_id_students_id_institution_id_fk" FOREIGN KEY ("student_id","institution_id") REFERENCES "public"."students"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_consultations_student_occurred_at" ON "student_consultations" USING btree ("student_id","occurred_at");--> statement-breakpoint
CREATE INDEX "student_observations_student_recorded_at" ON "student_observations" USING btree ("student_id","recorded_at");--> statement-breakpoint
-- Append-only por construção: só há política de leitura e de inserção. Sem política de
-- UPDATE/DELETE, a RLS (forçada também para o dono) faz qualquer reescrita afetar zero linhas.
-- A inserção exige que o autor seja o ator da transação: autoria não se forja pelo corpo.
ALTER TABLE "student_profile_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "student_profile_revisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "student_profile_revisions_tenant_read" ON "student_profile_revisions" FOR SELECT
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "student_profile_revisions_tenant_append" ON "student_profile_revisions" FOR INSERT
  WITH CHECK (
    "institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid
    AND "recorded_by_user_id" = nullif(current_setting('app.actor_id', true), '')::uuid
  );--> statement-breakpoint
ALTER TABLE "student_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "student_observations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "student_observations_tenant_read" ON "student_observations" FOR SELECT
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "student_observations_tenant_append" ON "student_observations" FOR INSERT
  WITH CHECK (
    "institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid
    AND "author_user_id" = nullif(current_setting('app.actor_id', true), '')::uuid
  );--> statement-breakpoint
-- Mesmo contrato das observações: só leitura e inserção, e quem registra é o ator da transação.
ALTER TABLE "student_consultations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "student_consultations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "student_consultations_tenant_read" ON "student_consultations" FOR SELECT
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "student_consultations_tenant_append" ON "student_consultations" FOR INSERT
  WITH CHECK (
    "institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid
    AND "professional_user_id" = nullif(current_setting('app.actor_id', true), '')::uuid
  );--> statement-breakpoint
INSERT INTO "permissions" ("key", "sensitive") VALUES ('record.read', true), ('record.write', true)
  ON CONFLICT ("key") DO UPDATE SET "sensitive" = true;--> statement-breakpoint
-- Instituições já provisionadas não passam de novo pelo seed de templates, que deixa papel
-- existente intacto. As chaves são novas, então concedê-las aqui não desfaz a remoção de
-- ninguém. O dono também obedece FORCE RLS; esta é a única janela sem FORCE.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("institution_id", "role_id", "permission_key", "scope")
  SELECT "roles"."institution_id", "roles"."id", "grants"."permission_key", "grants"."scope"::"permission_scope"
  FROM "roles"
  JOIN (VALUES
    ('care-assigned', 'record.read', 'assigned'),
    ('care-assigned', 'record.write', 'assigned'),
    ('care-institution', 'record.read', 'institution'),
    ('care-institution', 'record.write', 'institution')
  ) AS "grants" ("template_key", "permission_key", "scope") ON "grants"."template_key" = "roles"."template_key"
  WHERE "roles"."is_system"
  ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
