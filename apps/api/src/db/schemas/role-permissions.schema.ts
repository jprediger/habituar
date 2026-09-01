import { pgEnum, pgTable, text, uuid, unique } from 'drizzle-orm/pg-core';
import { roles } from './roles.schema';
import { permissions } from './permissions.schema';

export const permissionScopeEnum = pgEnum('permission_scope', ['own', 'assigned', 'institution']);

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }).notNull(),
  permissionKey: text('permission_key').references(() => permissions.key).notNull(),
  scope: permissionScopeEnum('scope').notNull(),
}, (table) => ({
  uniqueRolePermission: unique().on(table.roleId, table.permissionKey),
}));