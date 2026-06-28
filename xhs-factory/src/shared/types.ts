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
  status: DraftStatus
  createdAt: number
  updatedAt: number
}
export type DraftUpdate = Partial<
  Pick<Draft, 'titleOptions' | 'body' | 'tags' | 'coverCopy' | 'imageIdeas' | 'status'>
>

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
    remove: 'viral:remove',
    analyze: 'viral:analyze'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    getApiKey: 'settings:getApiKey', // 仅返回是否已设置
    setApiKey: 'settings:setApiKey'
  },
  ai: {
    generateContent: 'ai:generateContent',
    contentChunk: 'ai:content:chunk',
    contentDone: 'ai:content:done',
    contentError: 'ai:content:error'
  },
  exporter: {
    copy: 'export:copy',
    markdown: 'export:markdown'
  }
} as const
