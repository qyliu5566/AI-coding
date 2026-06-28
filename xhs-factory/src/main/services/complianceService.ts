import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type { ComplianceIssue } from '@shared/types'

const checkInput = z.object({
  title: z.string().default(''),
  body: z.string().default(''),
  tags: z.array(z.string()).default([])
})

export function checkCompliance(raw: unknown): ComplianceIssue[] {
  const input = checkInput.parse(raw)
  const text = [input.title, input.body, input.tags.join(' ')].join('\n')
  if (!text.trim()) return []

  const rules = getDb()
    .select()
    .from(schema.complianceRules)
    .where(eq(schema.complianceRules.enabled, true))
    .all()

  return rules
    .filter((rule) => rule.keyword && text.includes(rule.keyword))
    .map((rule) => ({
      ruleId: rule.id,
      severity: rule.severity,
      category: rule.category,
      matchedText: rule.keyword,
      message: rule.message,
      suggestion: rule.suggestion
    }))
}
