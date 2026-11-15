CREATE TABLE "classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "version" integer DEFAULT 1 NOT NULL,
  "archived_at" timestamptz,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "updated_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "classes_id_institution_id_unique" UNIQUE("id", "institution_id"),
  CONSTRAINT "classes_name_length" CHECK (char_length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "classes_description_length" CHECK ("description" IS NULL OR char_length("description") BETWEEN 1 AND 500)
);--> statement-breakpoint
CREATE UNIQUE INDEX "classes_active_name" ON "classes" ("institution_id", lower("name")) WHERE "archived_at" IS NULL;--> statement-breakpoint
CREATE TABLE "class_enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "enrolled_at" timestamptz DEFAULT now() NOT NULL,
  "left_at" timestamptz,
  "changed_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  CONSTRAINT "class_enrollments_class_tenant_fk" FOREIGN KEY ("class_id", "institution_id") REFERENCES "classes"("id", "institution_id") ON DELETE CASCADE,
  CONSTRAINT "class_enrollments_student_tenant_fk" FOREIGN KEY ("student_id", "institution_id") REFERENCES "students"("id", "institution_id") ON DELETE CASCADE,
  CONSTRAINT "class_enrollments_dates" CHECK ("left_at" IS NULL OR "left_at" >= "enrolled_at")
);--> statement-breakpoint
CREATE UNIQUE INDEX "class_enrollments_one_active" ON "class_enrollments" ("institution_id", "student_id") WHERE "left_at" IS NULL;--> statement-breakpoint
CREATE INDEX "class_enrollments_class" ON "class_enrollments" ("class_id", "enrolled_at");--> statement-breakpoint
CREATE TABLE "class_staff_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "institution_id" uuid NOT NULL REFERENCES "institutions"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL,
  "membership_id" uuid NOT NULL,
  "environment" role_environment NOT NULL,
  "linked_at" timestamptz DEFAULT now() NOT NULL,
  "left_at" timestamptz,
  "changed_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  CONSTRAINT "class_staff_members_class_tenant_fk" FOREIGN KEY ("class_id", "institution_id") REFERENCES "classes"("id", "institution_id") ON DELETE CASCADE,
  CONSTRAINT "class_staff_members_membership_tenant_fk" FOREIGN KEY ("membership_id", "institution_id") REFERENCES "memberships"("id", "institution_id") ON DELETE CASCADE,
  CONSTRAINT "class_staff_members_environment_fk" FOREIGN KEY ("membership_id", "environment") REFERENCES "memberships"("id", "environment") ON DELETE CASCADE,
  CONSTRAINT "class_staff_members_environment" CHECK ("environment" IN ('professional', 'monitor')),
  CONSTRAINT "class_staff_members_dates" CHECK ("left_at" IS NULL OR "left_at" >= "linked_at")
);--> statement-breakpoint
CREATE UNIQUE INDEX "class_staff_members_one_active" ON "class_staff_members" ("class_id", "membership_id") WHERE "left_at" IS NULL;--> statement-breakpoint
CREATE INDEX "class_staff_members_membership" ON "class_staff_members" ("membership_id", "left_at");--> statement-breakpoint
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "classes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "classes_tenant_isolation" ON "classes"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "class_enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "class_enrollments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "class_enrollments_tenant_isolation" ON "class_enrollments"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "class_staff_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "class_staff_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "class_staff_members_tenant_isolation" ON "class_staff_members"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
INSERT INTO "permissions" ("key", "sensitive") VALUES
  ('class.read', false), ('class.create', false), ('class.manage', false)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
-- Papéis preexistentes precisam receber as novas concessões sem novo seed.
-- Templates de sistema são provisionados pela instituição e, por isso, precisam de atualização.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("institution_id", "role_id", "permission_key", "scope")
SELECT r."institution_id", r."id", grant_values."key", grant_values."scope"::permission_scope
FROM "roles" r
JOIN (VALUES
  ('team-management', 'class.read', 'institution'),
  ('team-management', 'class.create', 'institution'),
  ('team-management', 'class.manage', 'institution'),
  ('care-institution', 'class.read', 'institution'),
  ('care-institution', 'class.create', 'institution'),
  ('care-institution', 'class.manage', 'institution'),
  ('care-assigned', 'class.read', 'assigned'),
  ('monitoring', 'class.read', 'assigned')
) AS grant_values("template", "key", "scope") ON r."template_key" = grant_values."template"
WHERE r."is_system"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
