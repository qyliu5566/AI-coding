import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type { Draft, DraftUpdate } from '@shared/types'

const createInput = z.object({
  topicId: z.number().int().nullable().default(null),
  personaId: z.number().int(),
  titleOptions: z.array(z.string()).default([]),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  coverCopy: z.string().default(''),
  imageIdeas: z.array(z.string()).default([]),
  status: z.enum(['draft', 'final']).default('draft')
})

const updateInput = z
  .object({
    titleOptions: z.array(z.string()),
    body: z.string(),
    tags: z.array(z.string()),
    coverCopy: z.string(),
    imageIdeas: z.array(z.string()),
    status: z.enum(['draft', 'final'])
  })
  .partial()

export function listDrafts(): Draft[] {
  return getDb().select().from(schema.drafts).orderBy(desc(schema.drafts.updatedAt)).all()
}

export function getDraft(id: number): Draft | null {
  return getDb().select().from(schema.drafts).where(eq(schema.drafts.id, id)).get() ?? null
}

export function createDraft(input: unknown): Draft {
  const data = createInput.parse(input)
  return getDb().insert(schema.drafts).values(data).returning().get()
}

export function updateDraft(id: number, patch: unknown): Draft {
  const data = updateInput.parse(patch) as DraftUpdate
  const row = getDb()
    .update(schema.drafts)
    .set({ ...data, updatedAt: sql`(unixepoch() * 1000)` })
    .where(eq(schema.drafts.id, id))
    .returning()
    .get()
  if (!row) throw new Error('草稿不存在')
  return row
}

export function removeDraft(id: number): void {
  getDb().delete(schema.drafts).where(eq(schema.drafts.id, id)).run()
}
