// 主进程 / 渲染进程共享的类型与契约（单一事实来源）

// ---------- IPC 统一返回 ----------
export interface IpcOk<T> {
  ok: true
  data: T
}
export interface IpcErr {
  ok: false
  error: string
}
export type IpcResult<T> = IpcOk<T> | IpcErr

// ---------- 领域模型 ----------
export type ProviderId = 'claude' | 'openai' | 'deepseek'
export type ImageProviderId = 'openai' | 'volcengine'
export type SecretProviderId = ProviderId | `image:${ImageProviderId}`

export interface Persona {
  id: number
  name: string
  niche: string // 赛道
  tone: string // 语气
  audience: string // 目标人群
  bio: string // 账号简介/补充设定
  createdAt: number
}
export type PersonaInput = Omit<Persona, 'id' | 'createdAt'>

export type TopicStatus = 'candidate' | 'selected' | 'written' | 'published'
export type TopicSource = 'ai' | 'manual'

export interface Topic {
  id: number
  personaId: number
  title: string
  angle: string // 切入角度
  hook: string // 钩子
  rationale: string // 为什么可能爆
  status: TopicStatus
  score: number | null // 预留：第二期打分
  source: TopicSource
  createdAt: number
}

export type DraftStatus = 'draft' | 'final'

export interface Draft {
  id: number
  topicId: number | null
  personaId: number
  titleOptions: string[]
  body: string
  tags: string[]
  coverCopy: string // 封面文案
  imageIdeas: string[] // 配图建议
  visualPlan: VisualPlan | null
  imageAssets: Record<string, GeneratedImageAsset>
  status: DraftStatus
  createdAt: number
  updatedAt: number
}
export type DraftUpdate = Partial<
  Pick<
    Draft,
    | 'titleOptions'
    | 'body'
    | 'tags'
    | 'coverCopy'
    | 'imageIdeas'
    | 'visualPlan'
    | 'imageAssets'
    | 'status'
  >
>
export type DraftVisualPayload = Pick<Draft, 'visualPlan' | 'imageAssets'>

export interface ViralStructure {
  hook: string // 标题钩子
  opening: string // 开头
  structure: string // 正文结构
  cta: string // 行动号召
}

export interface ViralSample {
  id: number
  personaId: number | null // 可空 = 通用样本
  title: string
  body: string
  tags: string[]
  structure: ViralStructure | null // AI 拆解结果
  notes: string
  createdAt: number
}
export type ViralSampleInput = Omit<ViralSample, 'id' | 'createdAt' | 'structure'> & {
  structure?: ViralStructure | null
}

export interface AppSettings {
  provider: ProviderId
  model: string
  imageProvider: ImageProviderId
  imageModel: string
  imageSize: '1024x1024' | '1024x1536' | '1536x1024' | '2K'
}

export type PublishStatus = 'planned' | 'published' | 'reviewed' | 'archived'

export interface PublishRecord {
  id: number
  draftId: number
  topicId: number | null
  personaId: number
  status: PublishStatus
  plannedAt: number | null
  publishedAt: number | null
  publishUrl: string
  noteId: string
  views: number
  likes: number
  collects: number
  comments: number
  shares: number
  follows: number
  notes: string
  createdAt: number
  updatedAt: number
}

export type PublishRecordInput = Partial<
  Pick<
    PublishRecord,
    | 'topicId'
    | 'status'
    | 'plannedAt'
    | 'publishedAt'
    | 'publishUrl'
    | 'noteId'
    | 'views'
    | 'likes'
    | 'collects'
    | 'comments'
    | 'shares'
    | 'follows'
    | 'notes'
  >
> & {
  draftId: number
  personaId: number
}

export type PublishRecordUpdate = Partial<Omit<PublishRecordInput, 'draftId' | 'personaId'>>
export type PublishMetricInput = Pick<
  PublishRecord,
  'views' | 'likes' | 'collects' | 'comments' | 'shares' | 'follows'
>

export interface FormulaPattern {
  id: number
  personaId: number | null
  sourceType: 'viral' | 'draft'
  sourceId: number | null
  name: string
  hookType: string
  opening: string
  structure: string
  cta: string
  applicableNiche: string
  audience: string
  notes: string
  createdAt: number
}

export interface FormulaPatternInput extends Omit<
  FormulaPattern,
  'id' | 'createdAt' | 'sourceType' | 'sourceId'
> {
  sourceType?: 'viral' | 'draft'
  sourceId?: number | null
}

export type ComplianceSeverity = 'low' | 'medium' | 'high'
export interface ComplianceIssue {
  ruleId: number | null
  severity: ComplianceSeverity
  category: string
  matchedText: string
  message: string
  suggestion: string
}

export interface AnalyticsOverview {
  totalPublished: number
  reviewedCount: number
  avgInteractionRate: number
  avgCollectRate: number
  highScoreTopics: number
}

export interface PersonaAnalytics extends AnalyticsOverview {
  personaId: number
  personaName: string
}

export interface TagAnalytics {
  tag: string
  count: number
  avgScore: number
}

// ---------- AI 生成的结构化产物 ----------
export interface GeneratedTopic {
  title: string
  angle: string
  hook: string
  rationale: string
}

export interface GeneratedContent {
  titleOptions: string[]
  body: string
  tags: string[]
  coverCopy: string
  imageIdeas: string[]
}

export type RevisionTarget = 'title' | 'body' | 'tags' | 'cover' | 'overall'

export interface RevisionSuggestion {
  id: string
  title: string
  reason: string
  instruction: string
  target: RevisionTarget
}

export interface ContentReview {
  overallScore: number
  summary: string
  suggestions: RevisionSuggestion[]
}

export interface RewriteContentInput {
  topicId: number
  currentContent: GeneratedContent
  suggestions?: RevisionSuggestion[]
  selectedSuggestionIds?: string[]
  customInstruction?: string
}

export interface RewriteSelectionInput {
  topicId: number
  currentContent: GeneratedContent
  selectedText: string
  customInstruction: string
}

export interface CoverVisualPlan {
  title: string
  subtitle: string
  layout: string
  style: string
  colorPalette: string
  elements: string[]
  prompt: string
}

export interface ContentImagePlan {
  id: string
  purpose: string
  textOverlay: string
  scene: string
  composition: string
  style: string
  prompt: string
}

export interface VisualPlan {
  cover: CoverVisualPlan
  images: ContentImagePlan[]
}

export interface GenerateVisualPlanInput {
  topicId: number
  content: GeneratedContent
}

export interface GenerateImageInput {
  prompt: string
  kind: 'cover' | 'content'
  planId: string
  size?: AppSettings['imageSize']
}

export interface GeneratedImageAsset {
  id: string
  planId: string
  kind: 'cover' | 'content'
  localPath: string
  dataUrl?: string
  prompt: string
  model: string
  size: string
  createdAt: number
}

// ---------- AI 调用入参 ----------
export interface GenerateTopicsInput {
  personaId: number
  keywords?: string
  count?: number
  sampleIds?: number[] // 参考的爆款样本
}

export interface GenerateContentInput {
  topicId: number
  sampleIds?: number[]
}

export interface AnalyzeViralInput {
  title: string
  body: string
}

// 流式正文事件（主 -> 渲染）
export interface ContentChunkEvent {
  requestId: string
  delta: string
}
export interface ContentDoneEvent {
  requestId: string
  content: GeneratedContent
}
export interface ContentErrorEvent {
  requestId: string
  error: string
}

// ---------- IPC 通道常量 ----------
export const IPC = {
  persona: {
    list: 'persona:list',
    create: 'persona:create',
    update: 'persona:update',
    remove: 'persona:remove'
  },
  topic: {
    list: 'topic:list',
    generate: 'topic:generate',
    create: 'topic:create',
    setStatus: 'topic:setStatus',
    remove: 'topic:remove',
    get: 'topic:get'
  },
  draft: {
    list: 'draft:list',
    get: 'draft:get',
    create: 'draft:create',
    update: 'draft:update',
    remove: 'draft:remove'
  },
  viral: {
    list: 'viral:list',
    create: 'viral:create',
    createBatch: 'viral:createBatch',
    remove: 'viral:remove',
    analyze: 'viral:analyze'
  },
  publish: {
    list: 'publish:list',
    create: 'publish:create',
    update: 'publish:update',
    remove: 'publish:remove',
    updateMetrics: 'publish:updateMetrics',
    review: 'publish:review'
  },
  analytics: {
    overview: 'analytics:overview',
    persona: 'analytics:persona',
    topicTags: 'analytics:topicTags',
    formulas: 'analytics:formulas'
  },
  formula: {
    list: 'formula:list',
    create: 'formula:create',
    createFromSample: 'formula:createFromSample',
    createFromDraft: 'formula:createFromDraft',
    remove: 'formula:remove'
  },
  compliance: {
    check: 'compliance:check'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    getApiKey: 'settings:getApiKey', // 仅返回是否已设置
    setApiKey: 'settings:setApiKey'
  },
  ai: {
    generateContent: 'ai:generateContent',
    reviewContent: 'ai:reviewContent',
    rewriteContent: 'ai:rewriteContent',
    rewriteSelection: 'ai:rewriteSelection',
    generateVisualPlan: 'ai:generateVisualPlan',
    generateImage: 'ai:generateImage',
    contentChunk: 'ai:content:chunk',
    contentDone: 'ai:content:done',
    contentError: 'ai:content:error'
  },
  exporter: {
    copy: 'export:copy',
    markdown: 'export:markdown'
  },
  asset: {
    imageDataUrl: 'asset:imageDataUrl'
  }
} as const
