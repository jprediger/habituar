CREATE TABLE "invitation_roles" (
	"invitation_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"environment" "role_environment" NOT NULL,
	CONSTRAINT "invitation_roles_invitation_id_role_id_unique" UNIQUE("invitation_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"email" text NOT NULL,
	"environment" "role_environment" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitations_id_environment_unique" UNIQUE("id","environment"),
	CONSTRAINT "invitations_id_institution_id_unique" UNIQUE("id","institution_id"),
	CONSTRAINT "invitations_terminal_state" CHECK ("invitations"."accepted_at" is null or "invitations"."revoked_at" is null)
);
--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"environment" "role_environment" NOT NULL,
	CONSTRAINT "membership_roles_membership_id_role_id_unique" UNIQUE("membership_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "role_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "document_type" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "document_number" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "environment" "role_environment";--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "template_key" text;--> statement-breakpoint
-- O dono também obedece FORCE RLS; o backfill é a única janela sem FORCE.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "memberships" SET "environment" = "roles"."environment" FROM "roles" WHERE "memberships"."role_id" = "roles"."id";--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "environment" SET NOT NULL;--> statement-breakpoint
UPDATE "roles" SET "template_key" = CASE "environment" WHEN 'student' THEN 'student' WHEN 'professional' THEN 'care-assigned' WHEN 'monitor' THEN 'monitoring' END WHERE "is_system" AND "environment" IS NOT NULL;--> statement-breakpoint
-- Papel legado sem ambiente não pode ser atribuído a nenhum tipo de vínculo: promovê-lo a
-- `professional` concederia a profissionais permissões que ninguém escolheu. Nenhum vínculo o
-- referencia (o NOT NULL de memberships.environment acima falharia antes), então ele sai.
DELETE FROM "roles" WHERE "environment" IS NULL;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "environment" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_id_environment_unique" UNIQUE("id","environment");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_id_institution_id_unique" UNIQUE("id","institution_id");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_id_environment_unique" UNIQUE("id","environment");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_id_institution_id_unique" UNIQUE("id","institution_id");--> statement-breakpoint
ALTER TABLE "invitation_roles" ADD CONSTRAINT "invitation_roles_invitation_id_environment_invitations_id_environment_fk" FOREIGN KEY ("invitation_id","environment") REFERENCES "public"."invitations"("id","environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_roles" ADD CONSTRAINT "invitation_roles_invitation_id_institution_id_invitations_id_institution_id_fk" FOREIGN KEY ("invitation_id","institution_id") REFERENCES "public"."invitations"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_roles" ADD CONSTRAINT "invitation_roles_role_id_environment_roles_id_environment_fk" FOREIGN KEY ("role_id","environment") REFERENCES "public"."roles"("id","environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_roles" ADD CONSTRAINT "invitation_roles_role_id_institution_id_roles_id_institution_id_fk" FOREIGN KEY ("role_id","institution_id") REFERENCES "public"."roles"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_environment_memberships_id_environment_fk" FOREIGN KEY ("membership_id","environment") REFERENCES "public"."memberships"("id","environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_institution_id_memberships_id_institution_id_fk" FOREIGN KEY ("membership_id","institution_id") REFERENCES "public"."memberships"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_environment_roles_id_environment_fk" FOREIGN KEY ("role_id","environment") REFERENCES "public"."roles"("id","environment") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_institution_id_roles_id_institution_id_fk" FOREIGN KEY ("role_id","institution_id") REFERENCES "public"."roles"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_email" ON "invitations" USING btree ("institution_id",lower("email")) WHERE "invitations"."accepted_at" is null and "invitations"."revoked_at" is null;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_document_number_unique" UNIQUE("document_number");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_institution_id_template_key_unique" UNIQUE("institution_id","template_key");--> statement-breakpoint
INSERT INTO "membership_roles" ("membership_id", "role_id", "institution_id", "environment") SELECT "id", "role_id", "institution_id", "environment" FROM "memberships";--> statement-breakpoint
INSERT INTO "permissions" ("key", "sensitive") VALUES ('student.read', false) ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_permission_key_unique";--> statement-breakpoint
DELETE FROM "role_permissions" a USING "role_permissions" b WHERE a.id > b.id AND a.role_id = b.role_id AND a.scope = b.scope AND a.permission_key IN ('student.read.own', 'student.read.assigned', 'student.read.institution') AND b.permission_key IN ('student.read.own', 'student.read.assigned', 'student.read.institution');--> statement-breakpoint
UPDATE "role_permissions" SET "permission_key" = 'student.read' WHERE "permission_key" IN ('student.read.own', 'student.read.assigned', 'student.read.institution');--> statement-breakpoint
DELETE FROM "permissions" WHERE "key" IN ('student.read.own', 'student.read.assigned', 'student.read.institution');--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "membership_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "membership_roles_tenant_isolation" ON "membership_roles" USING (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid) WITH CHECK (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "membership_roles_identity_bootstrap" ON "membership_roles" FOR SELECT USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.id = membership_roles.membership_id AND memberships.user_id = nullif(current_setting('app.actor_id', true), '')::uuid));--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "invitations_tenant_isolation" ON "invitations" USING (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid) WITH CHECK (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "invitations_token_lookup" ON "invitations" FOR SELECT USING (token_hash = nullif(current_setting('app.invitation_token_hash', true), ''));--> statement-breakpoint
ALTER TABLE "invitation_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitation_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "invitation_roles_tenant_isolation" ON "invitation_roles" USING (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid) WITH CHECK (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "invitation_roles_token_lookup" ON "invitation_roles" FOR SELECT USING (EXISTS (SELECT 1 FROM invitations WHERE invitations.id = invitation_roles.invitation_id AND invitations.token_hash = nullif(current_setting('app.invitation_token_hash', true), '')));
