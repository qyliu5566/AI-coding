import { desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type { ViralSample, ViralStructure } from '@shared/types'
import { getProvider } from '../ai'

const sampleInput = z.object({
  personaId: z.number().int().nullable().default(null),
  title: z.string().min(1, '标题不能为空'),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(''),
  structure: z
    .object({ hook: z.string(), opening: z.string(), structure: z.string(), cta: z.string() })
    .nullable()
    .default(null)
})

export function listSamples(): ViralSample[] {
  return getDb()
    .select()
    .from(schema.viralSamples)
    .orderBy(desc(schema.viralSamples.createdAt))
    .all()
}

export function getSamplesByIds(ids: number[]): ViralSample[] {
  if (!ids.length) return []
  return getDb()
    .select()
    .from(schema.viralSamples)
    .where(inArray(schema.viralSamples.id, ids))
    .all()
}

export function createSample(input: unknown): ViralSample {
  const data = sampleInput.parse(input)
  return getDb().insert(schema.viralSamples).values(data).returning().get()
}

export function createSamples(input: unknown): ViralSample[] {
  const data = z.array(sampleInput).parse(input)
  if (!data.length) return []
  return getDb().transaction((tx) =>
    data.map((sample) => tx.insert(schema.viralSamples).values(sample).returning().get())
  )
}

export function setStructure(id: number, structure: ViralStructure): ViralSample {
  const row = getDb()
    .update(schema.viralSamples)
    .set({ structure })
    .where(eq(schema.viralSamples.id, id))
    .returning()
    .get()
  if (!row) throw new Error('样本不存在')
  return row
}

export function removeSample(id: number): void {
  getDb().delete(schema.viralSamples).where(eq(schema.viralSamples.id, id)).run()
}

// AI 拆解爆款结构并存回该样本
export async function analyzeSample(id: number): Promise<ViralSample> {
  const sample = getSamplesByIds([id])[0]
  if (!sample) throw new Error('样本不存在')
  const structure = await getProvider().analyzeViral({ title: sample.title, body: sample.body })
  return setStructure(id, structure)
}
