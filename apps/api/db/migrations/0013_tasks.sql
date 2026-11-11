DROP TABLE "routine_blocks" CASCADE;--> statement-breakpoint
DROP TABLE "routine_entries" CASCADE;--> statement-breakpoint
DROP TABLE "routine_entry_evaluations" CASCADE;--> statement-breakpoint
DROP TABLE "routine_entry_photos" CASCADE;--> statement-breakpoint
DROP TYPE "public"."routine_entry_evaluation_outcome";--> statement-breakpoint
DROP TYPE "public"."routine_kind";--> statement-breakpoint
CREATE TYPE "public"."occurrence_exception_kind" AS ENUM('none', 'cancelled', 'moved');--> statement-breakpoint
CREATE TYPE "public"."schedule_recurrence_kind" AS ENUM('none', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."schedule_time_kind" AS ENUM('all-day', 'timed');--> statement-breakpoint
CREATE TYPE "public"."task_evaluation_outcome" AS ENUM('achieved', 'partial', 'not-achieved');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('class', 'study', 'therapy', 'activity', 'rest', 'other');--> statement-breakpoint
CREATE TYPE "public"."task_origin" AS ENUM('student', 'staff');--> statement-breakpoint
CREATE TABLE "task_occurrence_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"outcome" "task_evaluation_outcome" NOT NULL,
	"comment" text,
	"version" integer DEFAULT 1 NOT NULL,
	"evaluated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_occurrence_evaluations_occurrence_id_unique" UNIQUE("occurrence_id"),
	CONSTRAINT "task_occurrence_evaluations_comment_length" CHECK ("task_occurrence_evaluations"."comment" is null or char_length("task_occurrence_evaluations"."comment") between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "task_occurrence_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_occurrence_photos_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "task_occurrence_photos_media_type" CHECK ("task_occurrence_photos"."media_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "task_occurrence_photos_byte_size" CHECK ("task_occurrence_photos"."byte_size" between 1 and 2000000)
);
--> statement-breakpoint
CREATE TABLE "task_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"original_date" date NOT NULL,
	"exception_kind" "occurrence_exception_kind" DEFAULT 'none' NOT NULL,
	"moved_date" date,
	"moved_time_kind" "schedule_time_kind",
	"moved_starts_at" time,
	"moved_ends_at" time,
	"notes" text,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "task_occurrences_task_original_date" UNIQUE("task_id","original_date"),
	CONSTRAINT "task_occurrences_notes_length" CHECK ("task_occurrences"."notes" is null or char_length("task_occurrences"."notes") between 1 and 1000),
	CONSTRAINT "task_occurrences_completion" CHECK (("task_occurrences"."completed_at" is null) = ("task_occurrences"."completed_by_user_id" is null)),
	CONSTRAINT "task_occurrences_exception" CHECK (("task_occurrences"."exception_kind" = 'moved' and "task_occurrences"."moved_date" is not null and (("task_occurrences"."moved_time_kind" = 'all-day' and "task_occurrences"."moved_starts_at" is null and "task_occurrences"."moved_ends_at" is null) or ("task_occurrences"."moved_time_kind" = 'timed' and "task_occurrences"."moved_starts_at" is not null and "task_occurrences"."moved_ends_at" is not null and "task_occurrences"."moved_ends_at" > "task_occurrences"."moved_starts_at"))) or ("task_occurrences"."exception_kind" <> 'moved' and "task_occurrences"."moved_date" is null and "task_occurrences"."moved_time_kind" is null and "task_occurrences"."moved_starts_at" is null and "task_occurrences"."moved_ends_at" is null))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"origin" "task_origin" NOT NULL,
	"title" text NOT NULL,
	"kind" "task_kind",
	"notes" text,
	"starts_on" date NOT NULL,
	"time_kind" "schedule_time_kind" NOT NULL,
	"starts_at" time,
	"ends_at" time,
	"recurrence_kind" "schedule_recurrence_kind" NOT NULL,
	"recurrence_weekdays" smallint[],
	"recurrence_until" date,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tasks_id_student" UNIQUE("id","student_id"),
	CONSTRAINT "tasks_title_length" CHECK (char_length("tasks"."title") between 1 and 80),
	CONSTRAINT "tasks_notes_length" CHECK ("tasks"."notes" is null or char_length("tasks"."notes") between 1 and 500),
	CONSTRAINT "tasks_time" CHECK (("tasks"."time_kind" = 'all-day' and "tasks"."starts_at" is null and "tasks"."ends_at" is null) or ("tasks"."time_kind" = 'timed' and "tasks"."starts_at" is not null and "tasks"."ends_at" is not null and "tasks"."ends_at" > "tasks"."starts_at")),
	CONSTRAINT "tasks_recurrence" CHECK (("tasks"."recurrence_kind" = 'none' and "tasks"."recurrence_weekdays" is null and "tasks"."recurrence_until" is null) or ("tasks"."recurrence_kind" = 'daily' and "tasks"."recurrence_weekdays" is null) or ("tasks"."recurrence_kind" = 'weekly' and cardinality("tasks"."recurrence_weekdays") between 1 and 7 and "tasks"."recurrence_weekdays" <@ '{1,2,3,4,5,6,7}'::smallint[] and extract(isodow from "tasks"."starts_on")::smallint = any("tasks"."recurrence_weekdays"))),
	CONSTRAINT "tasks_recurrence_until" CHECK ("tasks"."recurrence_until" is null or "tasks"."recurrence_until" >= "tasks"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "time_zone" text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_occurrence_evaluations" ADD CONSTRAINT "task_occurrence_evaluations_occurrence_id_task_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."task_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrence_evaluations" ADD CONSTRAINT "task_occurrence_evaluations_evaluated_by_user_id_users_id_fk" FOREIGN KEY ("evaluated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrence_photos" ADD CONSTRAINT "task_occurrence_photos_occurrence_id_task_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."task_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrence_photos" ADD CONSTRAINT "task_occurrence_photos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_student_id_institution_id_students_id_institution_id_fk" FOREIGN KEY ("student_id","institution_id") REFERENCES "public"."students"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_occurrences" ADD CONSTRAINT "task_occurrences_task_id_student_id_tasks_id_student_id_fk" FOREIGN KEY ("task_id","student_id") REFERENCES "public"."tasks"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_student_id_institution_id_students_id_institution_id_fk" FOREIGN KEY ("student_id","institution_id") REFERENCES "public"."students"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_occurrence_photos_occurrence" ON "task_occurrence_photos" USING btree ("occurrence_id","created_at");--> statement-breakpoint
CREATE INDEX "task_occurrences_student_original_date" ON "task_occurrences" USING btree ("student_id","original_date");--> statement-breakpoint
CREATE INDEX "task_occurrences_student_moved_date" ON "task_occurrences" USING btree ("student_id","moved_date");--> statement-breakpoint
CREATE INDEX "tasks_student_starts_on" ON "tasks" USING btree ("student_id","starts_on");
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tasks_tenant_isolation" ON "tasks"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "task_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_occurrences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "task_occurrences_tenant_isolation" ON "task_occurrences"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "task_occurrence_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_occurrence_photos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "task_occurrence_photos_tenant_isolation" ON "task_occurrence_photos"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "task_occurrence_evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_occurrence_evaluations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "task_occurrence_evaluations_tenant_isolation" ON "task_occurrence_evaluations"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
INSERT INTO "permissions" ("key", "sensitive") VALUES ('task.read', false), ('task.write', false), ('task.own.write', false), ('task.complete', false), ('task.evaluate', false) ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Mesmo motivo da 0009: papéis já provisionados não passam de novo pelo seed de templates.
-- Cada concessão de rotina vira a de tarefa com o mesmo alcance, em papel de sistema ou
-- personalizado, para nenhum administrador perder o que tinha configurado. A chave antiga
-- sai do catálogo junto com as tabelas: concessão órfã quebraria a leitura dos papéis.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("institution_id", "role_id", "permission_key", "scope")
  SELECT "role_permissions"."institution_id", "role_permissions"."role_id", "renamed"."task_key", "role_permissions"."scope"
  FROM "role_permissions"
  JOIN (VALUES
    ('routine.read', 'task.read'),
    ('routine.write', 'task.write'),
    ('routine.entry.write', 'task.complete'),
    ('routine.entry.evaluate', 'task.evaluate')
  ) AS "renamed" ("routine_key", "task_key") ON "renamed"."routine_key" = "role_permissions"."permission_key"
  ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("institution_id", "role_id", "permission_key", "scope")
  SELECT "roles"."institution_id", "roles"."id", 'task.own.write', 'own'::"permission_scope"
  FROM "roles"
  WHERE "roles"."is_system" AND "roles"."template_key" = 'student'
  ON CONFLICT DO NOTHING;--> statement-breakpoint
DELETE FROM "role_permissions" WHERE "permission_key" IN ('routine.read', 'routine.write', 'routine.entry.write', 'routine.entry.evaluate');--> statement-breakpoint
DELETE FROM "permissions" WHERE "key" IN ('routine.read', 'routine.write', 'routine.entry.write', 'routine.entry.evaluate');--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
