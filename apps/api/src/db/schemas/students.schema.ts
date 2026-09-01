import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { institutions } from './institutions.schema';

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  ageRange: text('age_range').notNull(), // '6-10' | '11-14' | '15-18'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});