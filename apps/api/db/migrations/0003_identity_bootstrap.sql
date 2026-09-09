ALTER TABLE "users" ADD COLUMN "is_platform_administrator" boolean DEFAULT false NOT NULL;--> statement-breakpoint

DROP POLICY "roles_isolation" ON "roles";--> statement-breakpoint
CREATE POLICY "roles_tenant_isolation" ON "roles"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "roles_identity_bootstrap" ON "roles" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.user_id = nullif(current_setting('app.actor_id', true), '')::uuid
      AND memberships.institution_id = roles.institution_id
  ));--> statement-breakpoint

DROP POLICY "role_permissions_isolation" ON "role_permissions";--> statement-breakpoint
CREATE POLICY "role_permissions_tenant_isolation" ON "role_permissions"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "role_permissions_identity_bootstrap" ON "role_permissions" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.user_id = nullif(current_setting('app.actor_id', true), '')::uuid
      AND memberships.institution_id = role_permissions.institution_id
  ));--> statement-breakpoint

DROP POLICY "memberships_isolation" ON "memberships";--> statement-breakpoint
CREATE POLICY "memberships_tenant_isolation" ON "memberships"
  USING ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid)
  WITH CHECK ("institution_id" = nullif(current_setting('app.institution_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "memberships_identity_bootstrap" ON "memberships" FOR SELECT
  USING ("user_id" = nullif(current_setting('app.actor_id', true), '')::uuid);
