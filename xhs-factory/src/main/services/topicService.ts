import { and, desc, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type { Topic, TopicStatus, GenerateTopicsInput } from '@shared/types'
import { getPersona } from './personaService'
import { getSamplesByIds } from './viralService'
import { getProvider } from '../ai'

const STATUSES = ['candidate', 'selected', 'written', 'published'] as const

const manualInput = z.object({
  personaId: z.number().int(),
  title: z.string().min(1),
  angle: z.string().default(''),
  hook: z.string().default(''),
  rationale: z.string().default('')
})

const genInput = z.object({
  personaId: z.number().int(),
  keywords: z.string().optional().default(''),
  count: z.number().int().min(1).max(12).optional().default(6),
  sampleIds: z.array(z.number().int()).optional().default([])
})

export function listTopics(personaId?: number): Topic[] {
  const db = getDb()
  const q = db
    .select()
    .from(schema.topics)
    .orderBy(desc(schema.topics.createdAt), desc(schema.topics.id))
  const rows = personaId ? q.where(eq(schema.topics.personaId, personaId)).all() : q.all()
  return rows
}

export function getTopic(id: number): Topic | null {
  return getDb().select().from(schema.topics).where(eq(schema.topics.id, id)).get() ?? null
}

export function createTopic(input: unknown): Topic {
  const data = manualInput.parse(input)
  return getDb()
    .insert(schema.topics)
    .values({ ...data, source: 'manual', status: 'candidate' })
    .returning()
    .get()
}

export function setStatus(id: number, status: TopicStatus): Topic {
  if (!STATUSES.includes(status)) throw new Error('非法状态')
  const row = getDb()
    .update(schema.topics)
    .set({ status })
    .where(eq(schema.topics.id, id))
    .returning()
    .get()
  if (!row) throw new Error('选题不存在')
  return row
}

export function removeTopic(id: number): void {
  getDb().delete(schema.topics).where(eq(schema.topics.id, id)).run()
}

// AI 生成选题并落库为候选
export async function generateTopics(input: GenerateTopicsInput): Promise<Topic[]> {
  const { personaId, keywords, count, sampleIds } = genInput.parse(input)
  const persona = getPersona(personaId)
  if (!persona) throw new Error('请先选择一个人设')
  const samples = getSamplesByIds(sampleIds)
  const db = getDb()
  const highScoreTopics = db
    .select()
    .from(schema.topics)
    .where(and(eq(schema.topics.personaId, personaId), gte(schema.topics.score, 70)))
    .orderBy(desc(schema.topics.score))
    .limit(8)
    .all()
  const formulas = db
    .select()
    .from(schema.formulaPatterns)
    .where(eq(schema.formulaPatterns.personaId, personaId))
    .orderBy(desc(schema.formulaPatterns.createdAt))
    .limit(6)
    .all()

  const generated = await getProvider().generateTopics({
    persona,
    keywords,
    count,
    samples,
    highScoreTopics,
    formulas
  })

  return db.transaction((tx) =>
    generated.map((g) =>
      tx
        .insert(schema.topics)
        .values({
          personaId,
          title: g.title,
          angle: g.angle,
          hook: g.hook,
          rationale: g.rationale,
          source: 'ai',
          status: 'candidate'
        })
        .returning()
        .get()
    )
  )
}
