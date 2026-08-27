import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import { TestProject } from 'vitest/node'

type DatabaseUrls = {
  readonly applicationUrl: string
  readonly migrationUrl: string
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrls: DatabaseUrls
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('habituar')
    .withUsername('postgres')
    .withPassword('postgres')
    .start()
  const superuserPool = new Pool({ connectionString: container.getConnectionUri() })

  try {
    const bootstrap = await readFile(resolve(import.meta.dirname, '../../db/bootstrap.sql'), 'utf8')
    await superuserPool.query(bootstrap)
  } finally {
    await superuserPool.end()
  }

  const host = container.getHost()
  const port = String(container.getPort())
  const applicationUrl = `postgresql://habituar_app:habituar_app@${host}:${port}/habituar`
  const migrationUrl = `postgresql://habituar_owner:habituar_owner@${host}:${port}/habituar`
  const ownerPool = new Pool({ connectionString: migrationUrl })

  try {
    await migrate(drizzle(ownerPool), {
      migrationsFolder: resolve(import.meta.dirname, '../../db/migrations'),
    })
  } finally {
    await ownerPool.end()
  }

  project.provide('databaseUrls', { applicationUrl, migrationUrl })

  return async () => {
    await container.stop()
  }
}
