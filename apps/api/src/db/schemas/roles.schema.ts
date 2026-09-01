import { pgTable, boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { institutions } from './institutions.schema';

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  clonedFrom: uuid('cloned_from'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});