ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_role_id_permission_key_unique";--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_permission_key_scope_unique" UNIQUE("role_id","permission_key","scope");
