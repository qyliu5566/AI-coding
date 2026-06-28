import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type {
  PublishMetricInput,
  PublishRecord,
  PublishRecordInput,
  PublishRecordUpdate,
  PublishStatus
} from '@shared/types'

const STATUSES = ['planned', 'published', 'reviewed', 'archived'] as const

const metricsSchema = z.object({
  views: z.number().int().min(0).default(0),
  likes: z.number().int().min(0).default(0),
  collects: z.number().int().min(0).default(0),
  comments: z.number().int().min(0).default(0),
  shares: z.number().int().min(0).default(0),
  follows: z.number().int().min(0).default(0)
})

const createInput = metricsSchema
  .extend({
    draftId: z.number().int(),
    topicId: z.number().int().nullable().default(null),
    personaId: z.number().int(),
    status: z.enum(STATUSES).default('planned'),
    plannedAt: z.number().int().nullable().default(null),
    publishedAt: z.number().int().nullable().default(null),
    publishUrl: z.string().default(''),
    noteId: z.string().default(''),
    notes: z.string().default('')
  })
  .partial({
    views: true,
    likes: true,
    collects: true,
    comments: true,
    shares: true,
    follows: true
  })

const updateInput = createInput
  .omit({ draftId: true, personaId: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, '没有可更新的字段')

export function scoreRecord(record: Pick<PublishRecord, keyof PublishMetricInput>): number | null {
  if (record.views <= 0) return null
  const interaction =
    record.likes + record.collects * 1.4 + record.comments * 2 + record.shares * 2.2
  const followBonus = record.follows * 3
  return Math.max(0, Math.min(100, Math.round(((interaction + followBonus) / record.views) * 1000)))
}

function touch(): { updatedAt: ReturnType<typeof sql> } {
  return { updatedAt: sql`(unixepoch() * 1000)` }
}

export function listPublishRecords(filters?: {
  personaId?: number
  status?: PublishStatus
  from?: number
  to?: number
}): PublishRecord[] {
  const conditions = [
    filters?.personaId != null ? eq(schema.publishRecords.personaId, filters.personaId) : undefined,
    filters?.status ? eq(schema.publishRecords.status, filters.status) : undefined,
    filters?.from != null ? gte(schema.publishRecords.plannedAt, filters.from) : undefined,
    filters?.to != null ? lte(schema.publishRecords.plannedAt, filters.to) : undefined
  ].filter(Boolean)
  const q = getDb()
    .select()
    .from(schema.publishRecords)
    .orderBy(desc(schema.publishRecords.updatedAt))
  return conditions.length ? q.where(and(...conditions)).all() : q.all()
}

export function createPublishRecord(raw: PublishRecordInput): PublishRecord {
  const data = createInput.parse(raw)
  return getDb().insert(schema.publishRecords).values(data).returning().get()
}

export function updatePublishRecord(id: number, raw: PublishRecordUpdate): PublishRecord {
  const data = updateInput.parse(raw)
  const row = getDb()
    .update(schema.publishRecords)
    .set({ ...data, ...touch() })
    .where(eq(schema.publishRecords.id, id))
    .returning()
    .get()
  if (!row) throw new Error('发布记录不存在')
  if (row.status === 'reviewed') syncTopicScore(row)
  return row
}

export function updateMetrics(id: number, raw: PublishMetricInput): PublishRecord {
  const data = metricsSchema.parse(raw)
  return updatePublishRecord(id, data)
}

export function reviewPublishRecord(id: number): PublishRecord {
  const row = getDb()
    .update(schema.publishRecords)
    .set({ status: 'reviewed', ...touch() })
    .where(eq(schema.publishRecords.id, id))
    .returning()
    .get()
  if (!row) throw new Error('发布记录不存在')
  syncTopicScore(row)
  return row
}

export function removePublishRecord(id: number): void {
  getDb().delete(schema.publishRecords).where(eq(schema.publishRecords.id, id)).run()
}

function syncTopicScore(record: PublishRecord): void {
  if (record.topicId == null) return
  const score = scoreRecord(record)
  if (score == null) return
  getDb().update(schema.topics).set({ score }).where(eq(schema.topics.id, record.topicId)).run()
}
