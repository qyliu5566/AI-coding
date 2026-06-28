import type {
  GeneratedTopic,
  GeneratedContent,
  ViralStructure,
  Persona,
  Topic,
  ViralSample,
  FormulaPattern
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

// 统一的 AI Provider 接口。新增模型只需实现这个接口，不动调用方。
export interface AIProvider {
  readonly id: string
  generateTopics(ctx: TopicGenContext): Promise<GeneratedTopic[]>
  // 正文流式输出：onDelta 实时推增量，返回完整结构化内容
  generateContent(
    ctx: ContentGenContext,
    onDelta: (delta: string) => void
  ): Promise<GeneratedContent>
  analyzeViral(input: { title: string; body: string }): Promise<ViralStructure>
}
