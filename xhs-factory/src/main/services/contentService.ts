import { z } from 'zod'
import type {
  ContentReview,
  GenerateContentInput,
  GeneratedContent,
  RewriteContentInput,
  RewriteSelectionInput
} from '@shared/types'
import { getTopic } from './topicService'
import { getPersona } from './personaService'
import { getSamplesByIds } from './viralService'
import { getProvider } from '../ai'

const input = z.object({
  topicId: z.number().int(),
  sampleIds: z.array(z.number().int()).optional().default([])
})

const contentSchema = z.object({
  titleOptions: z.array(z.string()).default([]),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  coverCopy: z.string().default(''),
  imageIdeas: z.array(z.string()).default([])
})

const suggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  instruction: z.string(),
  target: z.enum(['title', 'body', 'tags', 'cover', 'overall'])
})

const reviewInput = z.object({
  topicId: z.number().int(),
  currentContent: contentSchema
})

const rewriteInput = z.object({
  topicId: z.number().int(),
  currentContent: contentSchema,
  suggestions: z.array(suggestionSchema).optional().default([]),
  selectedSuggestionIds: z.array(z.string()).optional().default([]),
  customInstruction: z.string().optional().default('')
})

const selectionRewriteInput = z.object({
  topicId: z.number().int(),
  currentContent: contentSchema,
  selectedText: z.string().min(1, '请先选中要改写的正文片段'),
  customInstruction: z.string().min(1, '请填写局部修改要求')
})

function getContentContext(topicId: number): {
  topic: NonNullable<ReturnType<typeof getTopic>>
  persona: NonNullable<ReturnType<typeof getPersona>>
} {
  const topic = getTopic(topicId)
  if (!topic) throw new Error('选题不存在')
  const persona = getPersona(topic.personaId)
  if (!persona) throw new Error('选题对应的人设已被删除')
  return { topic, persona }
}

export async function generateContent(
  raw: GenerateContentInput,
  onDelta: (delta: string) => void
): Promise<GeneratedContent> {
  const { topicId, sampleIds } = input.parse(raw)
  const { topic, persona } = getContentContext(topicId)
  const samples = getSamplesByIds(sampleIds)
  return getProvider().generateContent({ persona, topic, samples }, onDelta)
}

export async function reviewContent(raw: unknown): Promise<ContentReview> {
  const { topicId, currentContent } = reviewInput.parse(raw)
  if (!currentContent.body.trim()) throw new Error('请先生成或填写正文')
  const { topic, persona } = getContentContext(topicId)
  return getProvider().reviewContent({ persona, topic, content: currentContent })
}

export async function rewriteContent(raw: RewriteContentInput): Promise<GeneratedContent> {
  const { topicId, currentContent, suggestions, selectedSuggestionIds, customInstruction } =
    rewriteInput.parse(raw)
  if (!currentContent.body.trim()) throw new Error('请先生成或填写正文')
  const selected = suggestions.filter((s) => selectedSuggestionIds.includes(s.id))
  if (!selected.length && !customInstruction.trim()) {
    throw new Error('请勾选修改建议或输入修改要求')
  }
  const { topic, persona } = getContentContext(topicId)
  return getProvider().rewriteContent({
    persona,
    topic,
    content: currentContent,
    suggestions: selected,
    customInstruction
  })
}

export async function rewriteSelection(raw: RewriteSelectionInput): Promise<string> {
  const { topicId, currentContent, selectedText, customInstruction } =
    selectionRewriteInput.parse(raw)
  if (!currentContent.body.trim()) throw new Error('请先生成或填写正文')
  if (!currentContent.body.includes(selectedText)) throw new Error('选中文本不在当前正文中')
  const { topic, persona } = getContentContext(topicId)
  return getProvider().rewriteSelection({
    persona,
    topic,
    content: currentContent,
    selectedText,
    customInstruction
  })
}
