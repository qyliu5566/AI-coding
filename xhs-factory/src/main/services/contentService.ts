import { z } from 'zod'
import type { GenerateContentInput, GeneratedContent } from '@shared/types'
import { getTopic } from './topicService'
import { getPersona } from './personaService'
import { getSamplesByIds } from './viralService'
import { getProvider } from '../ai'

const input = z.object({
  topicId: z.number().int(),
  sampleIds: z.array(z.number().int()).optional().default([])
})

export async function generateContent(
  raw: GenerateContentInput,
  onDelta: (delta: string) => void
): Promise<GeneratedContent> {
  const { topicId, sampleIds } = input.parse(raw)
  const topic = getTopic(topicId)
  if (!topic) throw new Error('选题不存在')
  const persona = getPersona(topic.personaId)
  if (!persona) throw new Error('选题对应的人设已被删除')
  const samples = getSamplesByIds(sampleIds)
  return getProvider().generateContent({ persona, topic, samples }, onDelta)
}
