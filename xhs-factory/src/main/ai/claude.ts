import Anthropic from '@anthropic-ai/sdk'
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
import type { z } from 'zod'

function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

export class ClaudeProvider implements AIProvider {
  readonly id = 'claude'
  private client: Anthropic
  private model: string
  private oauth: boolean

  constructor(opts: { apiKey: string; model: string }) {
    // sk-ant-oat... 是 OAuth 访问令牌(Claude Code / cc-switch),需走 Bearer + oauth beta 头;
    // 其它(sk-ant-api...)走标准 API Key(x-api-key)。
    this.oauth = opts.apiKey.startsWith('sk-ant-oat')
    this.client = this.oauth
      ? new Anthropic({
          authToken: opts.apiKey,
          defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' }
        })
      : new Anthropic({ apiKey: opts.apiKey })
    this.model = opts.model
  }

  // OAuth 令牌要求系统提示首块为 Claude Code 身份声明，否则会被拒。
  private systemParam(): string | Anthropic.TextBlockParam[] {
    if (!this.oauth) return XHS_SYSTEM
    return [
      { type: 'text', text: "You are Claude Code, Anthropic's official CLI for Claude." },
      { type: 'text', text: XHS_SYSTEM }
    ]
  }

  // 结构化调用：API Key 模式用 output_config.format；OAuth 模式可能不支持该参数，
  // 故同时在 prompt 里要求 JSON，两种模式都能正确解析。
  private async structured<T>(
    prompt: string,
    schema: object,
    parser: z.ZodType<T>,
    maxTokens = 8000
  ): Promise<T> {
    const params: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      system: this.systemParam(),
      messages: [{ role: 'user', content: jsonInstruction(prompt, schema) }]
    }
    if (!this.oauth) params.output_config = { format: { type: 'json_schema', schema } }

    const res = await this.client.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming
    )
    if (res.stop_reason === 'refusal') throw new Error('模型拒绝了该请求')
    return parseJson(textOf(res), parser)
  }

  async generateTopics(ctx: TopicGenContext): Promise<GeneratedTopic[]> {
    const out = await this.structured(topicsPrompt(ctx), TOPICS_SCHEMA, topicsOut)
    return out.topics
  }

  async generateContent(
    ctx: ContentGenContext,
    onDelta: (delta: string) => void
  ): Promise<GeneratedContent> {
    // 1) 流式生成正文（实时推给 UI）
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8000,
      system: this.systemParam(),
      messages: [{ role: 'user', content: contentBodyPrompt(ctx) }]
    })
    stream.on('text', (t) => onDelta(t))
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') throw new Error('模型拒绝了该请求')
    const body = textOf(final).trim()

    // 2) 基于正文生成配套元素（结构化、可校验）
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
