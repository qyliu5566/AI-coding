import type {
  GeneratedTopic,
  GeneratedContent,
  ContentReview,
  VisualPlan,
  ViralStructure,
  Persona,
  Topic,
  ViralSample,
  FormulaPattern,
  RevisionSuggestion
} from '@shared/types'

// 选题生成上下文（已解析好的领域对象，Provider 只管调用模型）
export interface TopicGenContext {
  persona: Persona
  keywords: string
  count: number
  samples: ViralSample[]
  highScoreTopics?: Topic[]
  formulas?: FormulaPattern[]
}

// 创作生成上下文
export interface ContentGenContext {
  persona: Persona
  topic: Topic
  samples: ViralSample[]
}

export interface ContentReviewContext {
  persona: Persona
  topic: Topic
  content: GeneratedContent
}

export interface ContentRewriteContext extends ContentReviewContext {
  suggestions: RevisionSuggestion[]
  customInstruction: string
}

export interface SelectionRewriteContext extends ContentReviewContext {
  selectedText: string
  customInstruction: string
}

export interface VisualPlanContext extends ContentReviewContext {}

// 统一的 AI Provider 接口。新增模型只需实现这个接口，不动调用方。
export interface AIProvider {
  readonly id: string
  generateTopics(ctx: TopicGenContext): Promise<GeneratedTopic[]>
  // 正文流式输出：onDelta 实时推增量，返回完整结构化内容
  generateContent(
    ctx: ContentGenContext,
    onDelta: (delta: string) => void
  ): Promise<GeneratedContent>
  reviewContent(ctx: ContentReviewContext): Promise<ContentReview>
  rewriteContent(ctx: ContentRewriteContext): Promise<GeneratedContent>
  rewriteSelection(ctx: SelectionRewriteContext): Promise<string>
  generateVisualPlan(ctx: VisualPlanContext): Promise<VisualPlan>
  analyzeViral(input: { title: string; body: string }): Promise<ViralStructure>
}
