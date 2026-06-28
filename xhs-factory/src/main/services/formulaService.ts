import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type { FormulaPattern, FormulaPatternInput } from '@shared/types'

const input = z.object({
  personaId: z.number().int().nullable().default(null),
  sourceType: z.enum(['viral', 'draft']).default('viral'),
  sourceId: z.number().int().nullable().default(null),
  name: z.string().min(1, '公式名称不能为空'),
  hookType: z.string().default(''),
  opening: z.string().default(''),
  structure: z.string().default(''),
  cta: z.string().default(''),
  applicableNiche: z.string().default(''),
  audience: z.string().default(''),
  notes: z.string().default('')
})

export function listFormulas(personaId?: number): FormulaPattern[] {
  const q = getDb()
    .select()
    .from(schema.formulaPatterns)
    .orderBy(desc(schema.formulaPatterns.createdAt))
  return personaId ? q.where(eq(schema.formulaPatterns.personaId, personaId)).all() : q.all()
}

export function createFormula(raw: FormulaPatternInput): FormulaPattern {
  const data = input.parse(raw)
  return getDb().insert(schema.formulaPatterns).values(data).returning().get()
}

export function createFromSample(sampleId: number): FormulaPattern {
  const sample = getDb()
    .select()
    .from(schema.viralSamples)
    .where(eq(schema.viralSamples.id, sampleId))
    .get()
  if (!sample) throw new Error('样本不存在')
  const structure = sample.structure
  return createFormula({
    personaId: sample.personaId,
    sourceType: 'viral',
    sourceId: sample.id,
    name: sample.title.slice(0, 30),
    hookType: structure?.hook ?? sample.title,
    opening: structure?.opening ?? '',
    structure: structure?.structure ?? '',
    cta: structure?.cta ?? '',
    applicableNiche: sample.tags.join(' '),
    audience: '',
    notes: sample.notes
  })
}

export function createFromDraft(draftId: number): FormulaPattern {
  const draft = getDb().select().from(schema.drafts).where(eq(schema.drafts.id, draftId)).get()
  if (!draft) throw new Error('草稿不存在')
  return createFormula({
    personaId: draft.personaId,
    sourceType: 'draft',
    sourceId: draft.id,
    name: (draft.titleOptions[0] ?? '高表现草稿').slice(0, 30),
    hookType: draft.titleOptions[0] ?? '',
    opening: draft.body.split('\n').find(Boolean)?.slice(0, 120) ?? '',
    structure: '从高表现草稿沉淀：标题钩子 -> 正文痛点 -> 干货清单 -> CTA',
    cta: '引导收藏、评论或关注',
    applicableNiche: draft.tags.join(' '),
    audience: '',
    notes: draft.coverCopy
  })
}

export function removeFormula(id: number): void {
  getDb().delete(schema.formulaPatterns).where(eq(schema.formulaPatterns.id, id)).run()
}
