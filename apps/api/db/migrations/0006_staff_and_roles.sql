-- Até aqui só a plataforma emitia convite (1B); o default existe apenas para esse backfill e
-- sai em seguida, para que nenhuma escrita nova herde a autoridade de plataforma por omissão.
ALTER TABLE "invitations" ADD COLUMN "issuer_kind" text DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "issuer_kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "removed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_removed_by_user_id_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_institution_id_roles_id_institution_id_fk" FOREIGN KEY ("role_id","institution_id") REFERENCES "public"."roles"("id","institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_cloned_from_institution_id_roles_id_institution_id_fk" FOREIGN KEY ("cloned_from","institution_id") REFERENCES "public"."roles"("id","institution_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_issuer_kind" CHECK ("invitations"."issuer_kind" in ('institution', 'platform'));;--> statement-breakpoint
INSERT INTO "permissions" ("key", "sensitive") VALUES ('membership.read', false), ('membership.invite', false), ('membership.remove', false) ON CONFLICT DO NOTHING;--> statement-breakpoint
-- O dono também obedece FORCE RLS; a concessão aos templates existentes é a única janela sem FORCE.
-- `roles` também precisa sair do FORCE: sem tenant definido, o SELECT de origem voltaria vazio
-- e o INSERT terminaria sem erro e sem conceder nada.
-- O seed não reconcede permissão a papel já existente, então os templates antigos só mudam aqui.
ALTER TABLE "roles" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "role_permissions" ("institution_id", "role_id", "permission_key", "scope")
  SELECT "roles"."institution_id", "roles"."id", "grant"."key", 'institution'
  FROM "roles" CROSS JOIN (VALUES ('membership.read'), ('membership.invite'), ('membership.remove')) AS "grant"("key")
  WHERE "roles"."is_system" AND "roles"."template_key" = 'team-management'
  ON CONFLICT ("role_id", "permission_key", "scope") DO NOTHING;--> statement-breakpoint
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- Vínculo removido deixa de existir para o bootstrap de identidade: contexto, seleção de
-- instituição e papéis do ator não podem enxergá-lo, qualquer que seja a query de quem lê.
DROP POLICY "memberships_identity_bootstrap" ON "memberships";--> statement-breakpoint
CREATE POLICY "memberships_identity_bootstrap" ON "memberships" FOR SELECT
  USING ("user_id" = nullif(current_setting('app.actor_id', true), '')::uuid AND "removed_at" IS NULL);--> statement-breakpoint
DROP POLICY "roles_identity_bootstrap" ON "roles";--> statement-breakpoint
CREATE POLICY "roles_identity_bootstrap" ON "roles" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.user_id = nullif(current_setting('app.actor_id', true), '')::uuid
      AND memberships.institution_id = roles.institution_id
      AND memberships.removed_at IS NULL
  ));--> statement-breakpoint
DROP POLICY "role_permissions_identity_bootstrap" ON "role_permissions";--> statement-breakpoint
CREATE POLICY "role_permissions_identity_bootstrap" ON "role_permissions" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.user_id = nullif(current_setting('app.actor_id', true), '')::uuid
      AND memberships.institution_id = role_permissions.institution_id
      AND memberships.removed_at IS NULL
  ));--> statement-breakpoint
DROP POLICY "membership_roles_identity_bootstrap" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_identity_bootstrap" ON "membership_roles" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.id = membership_roles.membership_id
      AND memberships.user_id = nullif(current_setting('app.actor_id', true), '')::uuid
      AND memberships.removed_at IS NULL
  ));
