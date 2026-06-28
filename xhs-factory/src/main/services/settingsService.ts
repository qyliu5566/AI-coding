import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type { AppSettings, ImageProviderId, ProviderId } from '@shared/types'

const DEFAULTS: AppSettings = {
  provider: 'claude',
  model: 'claude-opus-4-8',
  imageProvider: 'openai',
  imageModel: 'gpt-image-1',
  imageSize: '1024x1536'
}

const settingsSchema = z.object({
  provider: z.enum(['claude', 'openai', 'deepseek']),
  model: z.string().min(1),
  imageProvider: z.enum(['openai', 'volcengine']),
  imageModel: z.string().min(1),
  imageSize: z.enum(['1024x1024', '1024x1536', '1536x1024', '2K'])
})

export function getSettings(): AppSettings {
  const db = getDb()
  const rows = db.select().from(schema.settings).all()
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    provider: (map.get('provider') as ProviderId) ?? DEFAULTS.provider,
    model: map.get('model') ?? DEFAULTS.model,
    imageProvider: (map.get('imageProvider') as ImageProviderId) ?? DEFAULTS.imageProvider,
    imageModel: map.get('imageModel') ?? DEFAULTS.imageModel,
    imageSize: (map.get('imageSize') as AppSettings['imageSize']) ?? DEFAULTS.imageSize
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
