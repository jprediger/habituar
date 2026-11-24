import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import * as schema from './schema.js'

const MIGRATIONS_DIRECTORY = new URL('../../db/migrations/meta/', import.meta.url)

const journalSchema = z.object({
  entries: z.array(z.object({ idx: z.number().int().nonnegative() })).nonempty(),
})

// O snapshot é formato interno do drizzle-kit: validar campo a campo seria reescrever o
// tipo dele. O teste só precisa do id; o resto quem interpreta é o próprio drizzle-kit.
const snapshotSchema = z.looseObject({ id: z.string() })

async function readJson(fileName: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(fileName, MIGRATIONS_DIRECTORY), 'utf8'))
}

async function readLatestSnapshot(): Promise<z.infer<typeof snapshotSchema>> {
  const { entries } = journalSchema.parse(await readJson('_journal.json'))
  const latestIndex = Math.max(...entries.map((entry) => entry.idx))

  return snapshotSchema.parse(await readJson(`${String(latestIndex).padStart(4, '0')}_snapshot.json`))
}

describe('database schema', () => {
  // Migração escrita à mão pode criar o banco certo enquanto `schema.ts` descreve outro:
  // a diferença só aparece no próximo `db:generate`, já misturada com mudança alheia.
  it('describes exactly the database the committed migrations create', async () => {
    const latestSnapshot = await readLatestSnapshot()

    await expect(
      generateMigration(latestSnapshot, generateDrizzleJson(schema, latestSnapshot.id)),
    ).resolves.toEqual([])
  })
})
