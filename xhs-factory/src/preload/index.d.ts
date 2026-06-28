import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  IpcResult,
  Persona,
  PersonaInput,
  Topic,
  TopicStatus,
  Draft,
  DraftUpdate,
  ViralSample,
  ViralSampleInput,
  PublishRecord,
  PublishRecordInput,
  PublishRecordUpdate,
  PublishMetricInput,
  PublishStatus,
  FormulaPattern,
  FormulaPatternInput,
  ComplianceIssue,
  AnalyticsOverview,
  PersonaAnalytics,
  TagAnalytics,
  AppSettings,
  ProviderId,
  GenerateTopicsInput,
  GeneratedContent,
  ContentChunkEvent
} from '@shared/types'

export interface Api {
  persona: {
    list: () => Promise<IpcResult<Persona[]>>
    create: (input: PersonaInput) => Promise<IpcResult<Persona>>
    update: (id: number, input: PersonaInput) => Promise<IpcResult<Persona>>
    remove: (id: number) => Promise<IpcResult<void>>
  }
  topic: {
    list: (personaId?: number) => Promise<IpcResult<Topic[]>>
    get: (id: number) => Promise<IpcResult<Topic | null>>
    generate: (input: GenerateTopicsInput) => Promise<IpcResult<Topic[]>>
    create: (
      input: Partial<Topic> & { personaId: number; title: string }
    ) => Promise<IpcResult<Topic>>
    setStatus: (id: number, status: TopicStatus) => Promise<IpcResult<Topic>>
    remove: (id: number) => Promise<IpcResult<void>>
  }
  draft: {
    list: () => Promise<IpcResult<Draft[]>>
    get: (id: number) => Promise<IpcResult<Draft | null>>
    create: (input: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>) => Promise<IpcResult<Draft>>
    update: (id: number, patch: DraftUpdate) => Promise<IpcResult<Draft>>
    remove: (id: number) => Promise<IpcResult<void>>
  }
  viral: {
    list: () => Promise<IpcResult<ViralSample[]>>
    create: (input: ViralSampleInput) => Promise<IpcResult<ViralSample>>
    createBatch: (input: ViralSampleInput[]) => Promise<IpcResult<ViralSample[]>>
    remove: (id: number) => Promise<IpcResult<void>>
    analyze: (id: number) => Promise<IpcResult<ViralSample>>
  }
  publish: {
    list: (filters?: {
      personaId?: number
      status?: PublishStatus
      from?: number
      to?: number
    }) => Promise<IpcResult<PublishRecord[]>>
    create: (input: PublishRecordInput) => Promise<IpcResult<PublishRecord>>
    update: (id: number, patch: PublishRecordUpdate) => Promise<IpcResult<PublishRecord>>
    remove: (id: number) => Promise<IpcResult<void>>
    updateMetrics: (id: number, metrics: PublishMetricInput) => Promise<IpcResult<PublishRecord>>
    review: (id: number) => Promise<IpcResult<PublishRecord>>
  }
  analytics: {
    overview: () => Promise<IpcResult<AnalyticsOverview>>
    persona: () => Promise<IpcResult<PersonaAnalytics[]>>
    topicTags: () => Promise<IpcResult<TagAnalytics[]>>
    formulas: () => Promise<
      IpcResult<Array<{ id: number; name: string; sourceType: string; uses: number }>>
    >
  }
  formula: {
    list: (personaId?: number) => Promise<IpcResult<FormulaPattern[]>>
    create: (input: FormulaPatternInput) => Promise<IpcResult<FormulaPattern>>
    createFromSample: (sampleId: number) => Promise<IpcResult<FormulaPattern>>
    createFromDraft: (draftId: number) => Promise<IpcResult<FormulaPattern>>
    remove: (id: number) => Promise<IpcResult<void>>
  }
  compliance: {
    check: (input: {
      title?: string
      body?: string
      tags?: string[]
    }) => Promise<IpcResult<ComplianceIssue[]>>
  }
  settings: {
    get: () => Promise<IpcResult<AppSettings>>
    set: (input: AppSettings) => Promise<IpcResult<AppSettings>>
    getApiKey: (provider: ProviderId) => Promise<IpcResult<boolean>>
    setApiKey: (provider: ProviderId, key: string) => Promise<IpcResult<boolean>>
  }
  exporter: {
    copy: (text: string) => Promise<IpcResult<boolean>>
    markdown: (draftId: number) => Promise<IpcResult<{ saved: boolean; path?: string }>>
  }
  ai: {
    generateContent: (input: {
      requestId: string
      topicId: number
      sampleIds?: number[]
    }) => Promise<IpcResult<GeneratedContent>>
    onContentChunk: (cb: (e: ContentChunkEvent) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
