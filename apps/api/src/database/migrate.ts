import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_MIGRATION_URL

if (connectionString === undefined) {
  throw new Error('DATABASE_MIGRATION_URL is required for database migrations')
}

const pool = new Pool({ connectionString })

try {
  await migrate(drizzle(pool), { migrationsFolder: './db/migrations' })
  console.info('Database migrations applied successfully')
} catch (error) {
  console.error('Database migration failed')
  console.dir(error, { depth: null })
  process.exitCode = 1
} finally {
  await pool.end()
}
