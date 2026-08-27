import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const tenantProbe = pgTable('tenant_probe', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  note: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
