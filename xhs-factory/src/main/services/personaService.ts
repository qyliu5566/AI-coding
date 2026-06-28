import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '../db/client'
import type { Persona, PersonaInput } from '@shared/types'

const personaInput = z.object({
  name: z.string().min(1, '名称不能为空'),
  niche: z.string().default(''),
  tone: z.string().default(''),
  audience: z.string().default(''),
  bio: z.string().default('')
})

export function listPersonas(): Persona[] {
  return getDb().select().from(schema.personas).orderBy(desc(schema.personas.createdAt)).all()
}

export function getPersona(id: number): Persona | null {
  return getDb().select().from(schema.personas).where(eq(schema.personas.id, id)).get() ?? null
}

export function createPersona(input: unknown): Persona {
  const data = personaInput.parse(input) as PersonaInput
  const row = getDb().insert(schema.personas).values(data).returning().get()
  return row
}

export function updatePersona(id: number, input: unknown): Persona {
  const data = personaInput.parse(input)
  const row = getDb()
    .update(schema.personas)
    .set(data)
    .where(eq(schema.personas.id, id))
    .returning()
    .get()
  if (!row) throw new Error('人设不存在')
  return row
}

export function removePersona(id: number): void {
  getDb().delete(schema.personas).where(eq(schema.personas.id, id)).run()
}
