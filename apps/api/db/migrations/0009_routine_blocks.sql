CREATE TYPE "public"."routine_kind" AS ENUM('class', 'study', 'therapy', 'activity', 'rest', 'other');--> statement-breakpoint
CREATE TABLE "routine_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"title" text NOT NULL,
	"kind" "routine_kind" NOT NULL,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "routine_blocks_weekday" CHECK ("routine_blocks"."weekday" between 1 and 7),
	CONSTRAINT "routine_blocks_time_order" CHECK ("routine_blocks"."ends_at" > "routine_blocks"."starts_at"),
	CONSTRAINT "routine_blocks_title_length" CHECK (char_length("routine_blocks"."title") between 1 and 80),
	CONSTRAINT "routine_blocks_notes_length" CHECK ("routine_blocks"."notes" is null or char_length("routine_blocks"."notes") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "routine_blocks" ADD CONSTRAINT "routine_blocks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_blocks" ADD CONSTRAINT "routine_blocks_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_blocks" ADD CONSTRAINT "routine_blocks_student_id_institution_id_students_id_institution_id_fk" FOREIGN KEY ("student_id","institution_id") REFERENCES "public"."students"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routine_blocks_student_weekday" ON "routine_blocks" USING btree ("student_id","weekday","starts_at");--> statement-breakpoint
ALTER TABLE "routine_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_blocks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "routine_blocks_tenant_isolation" ON "routine_blocks"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
INSERT INTO "permissions" ("key", "sensitive") VALUES ('routine.read', false), ('routine.write', false) ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Mesmo motivo da 0008: papéis já provisionados não passam de novo pelo seed de templates.
-- As chaves são novas, então concedê-las não desfaz a remoção de ninguém.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("institution_id", "role_id", "permission_key", "scope")
  SELECT "roles"."institution_id", "roles"."id", "grants"."permission_key", "grants"."scope"::"permission_scope"
  FROM "roles"
  JOIN (VALUES
    ('student', 'routine.read', 'own'),
    ('guardian', 'routine.read', 'own'),
    ('care-assigned', 'routine.read', 'assigned'),
    ('care-assigned', 'routine.write', 'assigned'),
    ('care-institution', 'routine.read', 'institution'),
    ('care-institution', 'routine.write', 'institution')
  ) AS "grants" ("template_key", "permission_key", "scope") ON "grants"."template_key" = "roles"."template_key"
  WHERE "roles"."is_system"
  ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
