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
    remove: (id: number) => Promise<IpcResult<void>>
    analyze: (id: number) => Promise<IpcResult<ViralSample>>
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
