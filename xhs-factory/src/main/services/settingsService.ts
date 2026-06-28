import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type { AppSettings, ProviderId } from '@shared/types'

const DEFAULTS: AppSettings = { provider: 'claude', model: 'claude-opus-4-8' }

const settingsSchema = z.object({
  provider: z.enum(['claude', 'openai', 'deepseek']),
  model: z.string().min(1)
})

export function getSettings(): AppSettings {
  const db = getDb()
  const rows = db.select().from(schema.settings).all()
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    provider: (map.get('provider') as ProviderId) ?? DEFAULTS.provider,
    model: map.get('model') ?? DEFAULTS.model
  }
}

export function setSettings(input: unknown): AppSettings {
  const parsed = settingsSchema.parse(input)
  const db = getDb()
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(parsed)) {
      tx.insert(schema.settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
        .run()
    }
  })
  return parsed
}
