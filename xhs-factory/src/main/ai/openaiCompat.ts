import OpenAI from 'openai'
import type { z } from 'zod'
import type {
  AIProvider,
  TopicGenContext,
  ContentGenContext,
  ContentReviewContext,
  ContentRewriteContext,
  SelectionRewriteContext,
  VisualPlanContext
} from './provider'
import type {
  GeneratedTopic,
  GeneratedContent,
  ViralStructure,
  ContentReview,
  VisualPlan
} from '@shared/types'
import {
  XHS_SYSTEM,
  topicsPrompt,
  contentBodyPrompt,
  contentMetaPrompt,
  viralAnalyzePrompt,
  contentReviewPrompt,
  contentRewritePrompt,
  selectionRewritePrompt,
  visualPlanPrompt
} from './prompts'
import {
  topicsOut,
  metaOut,
  contentOut,
  structureOut,
  reviewOut,
  selectionRewriteOut,
  visualPlanOut,
  TOPICS_SCHEMA,
  META_SCHEMA,
  CONTENT_SCHEMA,
  STRUCTURE_SCHEMA,
  REVIEW_SCHEMA,
  SELECTION_REWRITE_SCHEMA,
  VISUAL_PLAN_SCHEMA,
  jsonInstruction,
  parseJson
} from './parsing'

// 通用 OpenAI 兼容 Provider（DeepSeek、OpenAI 等共用一套实现）。
// 新增同类模型只需在工厂里传不同的 baseURL / id / 默认模型。
export class OpenAICompatProvider implements AIProvider {
  readonly id: string
  private client: OpenAI
  private model: string
  private jsonMode: boolean

  constructor(opts: { id: string; apiKey: string; model: string; baseURL?: string }) {
    this.id = opts.id
    this.model = opts.model
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL })
    // 推理类模型(如 deepseek-reasoner)不支持 json_object，靠 prompt 约束 + 解析兜底
    this.jsonMode = !/reason/i.test(opts.model)
  }

  private async structured<T>(
    prompt: string,
    schema: object,
    parser: z.ZodType<T>,
    maxTokens = 8000
  ): Promise<T> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      ...(this.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: XHS_SYSTEM },
        { role: 'user', content: jsonInstruction(prompt, schema) }
      ]
    })
    return parseJson(res.choices[0]?.message?.content ?? '', parser)
  }

  async generateTopics(ctx: TopicGenContext): Promise<GeneratedTopic[]> {
    const out = await this.structured(topicsPrompt(ctx), TOPICS_SCHEMA, topicsOut)
    return out.topics
  }

  async generateContent(
    ctx: ContentGenContext,
    onDelta: (delta: string) => void
  ): Promise<GeneratedContent> {
    // 1) 流式生成正文
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 8000,
      stream: true,
      messages: [
        { role: 'system', content: XHS_SYSTEM },
        { role: 'user', content: contentBodyPrompt(ctx) }
      ]
    })
    let body = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        body += delta
        onDelta(delta)
      }
    }
    body = body.trim()

    // 2) 配套元素（结构化）
    const meta = await this.structured(
      contentMetaPrompt({ topic: ctx.topic, body }),
      META_SCHEMA,
      metaOut,
      4000
    )
    return { body, ...meta }
  }

  async reviewContent(ctx: ContentReviewContext): Promise<ContentReview> {
    return this.structured(contentReviewPrompt(ctx), REVIEW_SCHEMA, reviewOut, 4000)
  }

  async rewriteContent(ctx: ContentRewriteContext): Promise<GeneratedContent> {
    return this.structured(contentRewritePrompt(ctx), CONTENT_SCHEMA, contentOut, 8000)
  }

  async rewriteSelection(ctx: SelectionRewriteContext): Promise<string> {
    const out = await this.structured(
      selectionRewritePrompt(ctx),
      SELECTION_REWRITE_SCHEMA,
      selectionRewriteOut,
      3000
    )
    return out.replacement
  }

  async generateVisualPlan(ctx: VisualPlanContext): Promise<VisualPlan> {
    return this.structured(visualPlanPrompt(ctx), VISUAL_PLAN_SCHEMA, visualPlanOut, 6000)
  }

  async analyzeViral(input: { title: string; body: string }): Promise<ViralStructure> {
    return this.structured(viralAnalyzePrompt(input), STRUCTURE_SCHEMA, structureOut, 4000)
  }
}
