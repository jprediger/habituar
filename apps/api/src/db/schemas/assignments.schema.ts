import { pgTable, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { students } from './students.schema';

export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffUserId: uuid('staff_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAssignment: unique().on(table.staffUserId, table.studentId),
}));