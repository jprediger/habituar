import { pgTable, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { students } from './students.schema';
import { institutions } from './institutions.schema';

export const guardians = pgTable('guardians', {
  id: uuid('id').primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').references(() => institutions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueGuardianStudent: unique().on(table.userId, table.studentId),
}));