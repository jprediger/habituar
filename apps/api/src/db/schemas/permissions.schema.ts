import { pgTable, boolean, text } from 'drizzle-orm/pg-core';

// Espelha PERMISSION_CATALOG do @habituar/core — existe só pra dar integridade
// referencial a role_permissions. Fonte da verdade continua sendo o código.
export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  sensitive: boolean('sensitive').default(false).notNull(),
});