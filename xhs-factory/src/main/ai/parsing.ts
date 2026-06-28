import { z } from 'zod'

// ---- 校验 AI 返回（外部输入一律 zod 校验后再使用）----
export const topicsOut = z.object({
  topics: z.array(
    z.object({
      title: z.string(),
      angle: z.string().default(''),
      hook: z.string().default(''),
      rationale: z.string().default('')
    })
  )
})
export const metaOut = z.object({
  titleOptions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  coverCopy: z.string().default(''),
  imageIdeas: z.array(z.string()).default([])
})
export const structureOut = z.object({
  hook: z.string().default(''),
  opening: z.string().default(''),
  structure: z.string().default(''),
  cta: z.string().default('')
})

// ---- JSON Schema（供支持 structured outputs 的模型使用）----
export const TOPICS_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          angle: { type: 'string' },
          hook: { type: 'string' },
          rationale: { type: 'string' }
        },
        required: ['title', 'angle', 'hook', 'rationale'],
        additionalProperties: false
      }
    }
  },
  required: ['topics'],
  additionalProperties: false
}
export const META_SCHEMA = {
  type: 'object',
  properties: {
    titleOptions: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    coverCopy: { type: 'string' },
    imageIdeas: { type: 'array', items: { type: 'string' } }
  },
  required: ['titleOptions', 'tags', 'coverCopy', 'imageIdeas'],
  additionalProperties: false
}
export const STRUCTURE_SCHEMA = {
  type: 'object',
  properties: {
    hook: { type: 'string' },
    opening: { type: 'string' },
    structure: { type: 'string' },
    cta: { type: 'string' }
  },
  required: ['hook', 'opening', 'structure', 'cta'],
  additionalProperties: false
}

// 去掉可能包裹 JSON 的 ```json ... ``` 代码块
export function stripFence(text: string): string {
  const t = text.trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return (m ? m[1] : t).trim()
}

// 在 prompt 末尾追加「只返回匹配该 schema 的 JSON」指令
export function jsonInstruction(prompt: string, schema: object): string {
  return `${prompt}

只返回一个 JSON，严格匹配下面的 JSON Schema，不要包含任何解释或 Markdown 代码块：
${JSON.stringify(schema)}`
}

// 解析模型返回的 JSON 文本并 zod 校验
export function parseJson<T>(raw: string, parser: z.ZodType<T>): T {
  let json: unknown
  try {
    json = JSON.parse(stripFence(raw))
  } catch {
    throw new Error('AI 返回的内容无法解析为 JSON')
  }
  return parser.parse(json)
}
