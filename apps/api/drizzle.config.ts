import { defineConfig } from 'drizzle-kit'

const migrationUrl = process.env.DATABASE_MIGRATION_URL

if (migrationUrl === undefined) {
  throw new Error('DATABASE_MIGRATION_URL is required for database migrations')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './db/migrations',
  dbCredentials: { url: migrationUrl },
})
