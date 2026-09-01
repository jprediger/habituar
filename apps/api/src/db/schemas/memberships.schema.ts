import { pgTable, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { institutions } from './institutions.schema';
import { roles } from './roles.schema';

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => roles.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueMembership: unique().on(table.userId, table.institutionId),
}));