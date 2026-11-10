CREATE TYPE "public"."routine_entry_evaluation_outcome" AS ENUM('achieved', 'partial', 'not-achieved');--> statement-breakpoint
CREATE TABLE "routine_entry_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"outcome" "routine_entry_evaluation_outcome" NOT NULL,
	"comment" text,
	"version" integer DEFAULT 1 NOT NULL,
	"evaluated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "routine_entry_evaluations_entry_id_unique" UNIQUE("entry_id"),
	CONSTRAINT "routine_entry_evaluations_comment_length" CHECK ("routine_entry_evaluations"."comment" is null or char_length("routine_entry_evaluations"."comment") between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "routine_entries" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "routine_entries" ADD COLUMN "delivered_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "routine_entry_evaluations" ADD CONSTRAINT "routine_entry_evaluations_entry_id_routine_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."routine_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entry_evaluations" ADD CONSTRAINT "routine_entry_evaluations_evaluated_by_user_id_users_id_fk" FOREIGN KEY ("evaluated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_delivered_by_user_id_users_id_fk" FOREIGN KEY ("delivered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_delivery" CHECK (("routine_entries"."delivered_at" is null) = ("routine_entries"."delivered_by_user_id" is null));--> statement-breakpoint
ALTER TABLE "routine_entry_evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine_entry_evaluations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "routine_entry_evaluations_tenant_isolation" ON "routine_entry_evaluations"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
INSERT INTO "permissions" ("key", "sensitive") VALUES ('routine.entry.evaluate', false) ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Mesmo motivo da 0009: papéis já provisionados não passam de novo pelo seed de templates.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("institution_id", "role_id", "permission_key", "scope")
  SELECT "roles"."institution_id", "roles"."id", "grants"."permission_key", "grants"."scope"::"permission_scope"
  FROM "roles"
  JOIN (VALUES
    ('care-assigned', 'routine.entry.evaluate', 'assigned'),
    ('care-institution', 'routine.entry.evaluate', 'institution')
  ) AS "grants" ("template_key", "permission_key", "scope") ON "grants"."template_key" = "roles"."template_key"
  WHERE "roles"."is_system"
  ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
