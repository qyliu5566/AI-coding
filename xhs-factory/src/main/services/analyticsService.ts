import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db/client'
import type {
  AnalyticsOverview,
  PersonaAnalytics,
  PublishRecord,
  TagAnalytics
} from '@shared/types'
import { scoreRecord } from './publishService'

function reviewed(records: PublishRecord[]): PublishRecord[] {
  return records.filter((r) => r.status === 'reviewed')
}

function overviewOf(records: PublishRecord[]): AnalyticsOverview {
  const done = reviewed(records)
  const rates = done.filter((r) => r.views > 0)
  const avg = (values: number[]): number =>
    values.length
      ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 1000) / 10
      : 0
  return {
    totalPublished: records.filter((r) => r.status === 'published' || r.status === 'reviewed')
      .length,
    reviewedCount: done.length,
    avgInteractionRate: avg(
      rates.map((r) => (r.likes + r.collects + r.comments + r.shares) / r.views)
    ),
    avgCollectRate: avg(rates.map((r) => r.collects / r.views)),
    highScoreTopics: done.filter((r) => (scoreRecord(r) ?? 0) >= 70).length
  }
}

export function getOverview(): AnalyticsOverview {
  return overviewOf(getDb().select().from(schema.publishRecords).all())
}

export function getPersonaAnalytics(): PersonaAnalytics[] {
  const db = getDb()
  const personas = db.select().from(schema.personas).all()
  const records = db.select().from(schema.publishRecords).all()
  return personas.map((p) => ({
    personaId: p.id,
    personaName: p.name,
    ...overviewOf(records.filter((r) => r.personaId === p.id))
  }))
}

export function getTagAnalytics(): TagAnalytics[] {
  const db = getDb()
  const records = reviewed(db.select().from(schema.publishRecords).all())
  const buckets = new Map<string, { count: number; score: number }>()
  for (const record of records) {
    const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, record.draftId)).get()
    if (!draft) continue
    const score = scoreRecord(record) ?? 0
    for (const tag of draft.tags) {
      const cur = buckets.get(tag) ?? { count: 0, score: 0 }
      buckets.set(tag, { count: cur.count + 1, score: cur.score + score })
    }
  }
  return Array.from(buckets.entries())
    .map(([tag, v]) => ({ tag, count: v.count, avgScore: Math.round(v.score / v.count) }))
    .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count)
}

export function getFormulaAnalytics(): Array<{
  id: number
  name: string
  sourceType: string
  uses: number
}> {
  return getDb()
    .select()
    .from(schema.formulaPatterns)
    .all()
    .map((f) => ({ id: f.id, name: f.name, sourceType: f.sourceType, uses: 0 }))
}
