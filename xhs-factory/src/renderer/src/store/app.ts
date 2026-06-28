import { create } from 'zustand'
import type {
  ContentReview,
  GeneratedContent,
  GeneratedImageAsset,
  Persona,
  Topic,
  VisualPlan
} from '@shared/types'
import { unwrap } from '@/lib/ipc'

export interface ComposeVersion {
  id: string
  label: string
  source: 'generate' | 'rewrite' | 'selection' | 'manual'
  createdAt: number
  content: GeneratedContent
}

export interface ComposeSession {
  topicId: number
  topic: Topic
  draftId: number | null
  requestId: string
  sampleIds: number[]
  showSamples: boolean
  generating: boolean
  hasContent: boolean
  titleOptions: string[]
  primaryIndex: number
  body: string
  tagsText: string
  coverCopy: string
  imageIdeasText: string
  error: string | null
  versions: ComposeVersion[]
  activeVersionId: string | null
  visualPlan: VisualPlan | null
  imageAssets: Record<string, GeneratedImageAsset>
  review: ContentReview | null
  selectedSuggestionIds: string[]
  customInstruction: string
  selectionInstruction: string
  customSelectionOpen: boolean
  bodySelection: { start: number; end: number; text: string }
  reviewing: boolean
  rewriting: boolean
  rewritingSelection: boolean
  visualGenerating: boolean
  generatingImageKey: string | null
}

type ComposeSessionPatch = Partial<
  Pick<
    ComposeSession,
    | 'topic'
    | 'draftId'
    | 'sampleIds'
    | 'showSamples'
    | 'hasContent'
    | 'titleOptions'
    | 'primaryIndex'
    | 'body'
    | 'tagsText'
    | 'coverCopy'
    | 'imageIdeasText'
    | 'error'
    | 'visualPlan'
    | 'imageAssets'
    | 'review'
    | 'selectedSuggestionIds'
    | 'customInstruction'
    | 'selectionInstruction'
    | 'customSelectionOpen'
    | 'bodySelection'
    | 'reviewing'
    | 'rewriting'
    | 'rewritingSelection'
    | 'visualGenerating'
    | 'generatingImageKey'
  >
>

interface AppState {
  personas: Persona[]
  selectedPersonaId: number | null
  loadingPersonas: boolean
  composeSessions: Record<number, ComposeSession>
  loadPersonas: () => Promise<void>
  selectPersona: (id: number | null) => void
  ensureComposeSession: (topic: Topic) => ComposeSession
  generateContent: (topic: Topic, sampleIds: number[]) => Promise<void>
  updateComposeSession: (topicId: number, patch: ComposeSessionPatch) => void
  clearComposeSession: (topicId: number) => void
  addComposeVersion: (
    topicId: number,
    source: ComposeVersion['source'],
    label?: string
  ) => ComposeVersion | null
  restoreComposeVersion: (topicId: number, versionId: string) => void
}

function sessionContent(session: ComposeSession): GeneratedContent {
  return {
    titleOptions: session.titleOptions,
    body: session.body,
    tags: session.tagsText
      .split(/[\s,，#]+/)
      .map((t) => t.trim())
      .filter(Boolean),
    coverCopy: session.coverCopy,
    imageIdeas: session.imageIdeasText
      .split('\n')
      .map((l) => l.replace(/^[-•\s]+/, '').trim())
      .filter(Boolean)
  }
}

function versionFrom(
  session: ComposeSession,
  source: ComposeVersion['source'],
  label?: string
): ComposeVersion {
  const createdAt = Date.now()
  const prefix =
    source === 'generate'
      ? '初稿'
      : source === 'rewrite'
        ? '整篇改写'
        : source === 'selection'
          ? '局部改写'
          : '手动版本'
  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    label: label || `${prefix} ${new Date(createdAt).toLocaleTimeString()}`,
    source,
    createdAt,
    content: sessionContent(session)
  }
}

function createComposeSession(topic: Topic, existing?: ComposeSession): ComposeSession {
  return {
    topicId: topic.id,
    topic,
    draftId: existing?.draftId ?? null,
    requestId: existing?.requestId ?? '',
    sampleIds: existing?.sampleIds ?? [],
    showSamples: existing?.showSamples ?? false,
    generating: existing?.generating ?? false,
    hasContent: existing?.hasContent ?? false,
    titleOptions: existing?.titleOptions ?? [],
    primaryIndex: existing?.primaryIndex ?? 0,
    body: existing?.body ?? '',
    tagsText: existing?.tagsText ?? '',
    coverCopy: existing?.coverCopy ?? '',
    imageIdeasText: existing?.imageIdeasText ?? '',
    error: existing?.error ?? null,
    versions: existing?.versions ?? [],
    activeVersionId: existing?.activeVersionId ?? null,
    visualPlan: existing?.visualPlan ?? null,
    imageAssets: existing?.imageAssets ?? {},
    review: existing?.review ?? null,
    selectedSuggestionIds: existing?.selectedSuggestionIds ?? [],
    customInstruction: existing?.customInstruction ?? '',
    selectionInstruction: existing?.selectionInstruction ?? '',
    customSelectionOpen: existing?.customSelectionOpen ?? false,
    bodySelection: existing?.bodySelection ?? { start: 0, end: 0, text: '' },
    reviewing: existing?.reviewing ?? false,
    rewriting: existing?.rewriting ?? false,
    rewritingSelection: existing?.rewritingSelection ?? false,
    visualGenerating: existing?.visualGenerating ?? false,
    generatingImageKey: existing?.generatingImageKey ?? null
  }
}

function applyContent(session: ComposeSession, content: GeneratedContent): ComposeSession {
  return {
    ...session,
    hasContent: true,
    titleOptions: content.titleOptions,
    primaryIndex: 0,
    body: content.body,
    tagsText: content.tags.join(' '),
    coverCopy: content.coverCopy,
    imageIdeasText: content.imageIdeas.join('\n')
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  personas: [],
  selectedPersonaId: null,
  loadingPersonas: false,
  composeSessions: {},
  loadPersonas: async () => {
    set({ loadingPersonas: true })
    try {
      const personas = await unwrap(window.api.persona.list())
      const cur = get().selectedPersonaId
      const stillValid = cur != null && personas.some((p) => p.id === cur)
      set({
        personas,
        selectedPersonaId: stillValid ? cur : (personas[0]?.id ?? null)
      })
    } finally {
      set({ loadingPersonas: false })
    }
  },
  selectPersona: (id) => set({ selectedPersonaId: id }),
  ensureComposeSession: (topic) => {
    const existing = get().composeSessions[topic.id]
    const next = createComposeSession(topic, existing)
    if (!existing || existing.topic !== topic) {
      set((state) => ({
        composeSessions: {
          ...state.composeSessions,
          [topic.id]: next
        }
      }))
    }
    return next
  },
  updateComposeSession: (topicId, patch) =>
    set((state) => {
      const cur = state.composeSessions[topicId]
      if (!cur) return state
      return {
        composeSessions: {
          ...state.composeSessions,
          [topicId]: { ...cur, ...patch }
        }
      }
    }),
  clearComposeSession: (topicId) =>
    set((state) => {
      const composeSessions = { ...state.composeSessions }
      delete composeSessions[topicId]
      return { composeSessions }
    }),
  generateContent: async (topic, sampleIds) => {
    const existing = get().composeSessions[topic.id]
    if (existing?.generating) return

    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())

    set((state) => ({
      composeSessions: {
        ...state.composeSessions,
        [topic.id]: {
          ...createComposeSession(topic, existing),
          requestId,
          sampleIds,
          generating: true,
          hasContent: false,
          titleOptions: [],
          primaryIndex: 0,
          body: '',
          tagsText: '',
          coverCopy: '',
          imageIdeasText: '',
          error: null,
          versions: existing?.versions ?? [],
          activeVersionId: existing?.activeVersionId ?? null,
          visualPlan: existing?.visualPlan ?? null,
          imageAssets: existing?.imageAssets ?? {}
        }
      }
    }))

    const off = window.api.ai.onContentChunk((e) => {
      if (e.requestId !== requestId) return
      set((state) => {
        const cur = state.composeSessions[topic.id]
        if (!cur || cur.requestId !== requestId) return state
        return {
          composeSessions: {
            ...state.composeSessions,
            [topic.id]: { ...cur, body: cur.body + e.delta }
          }
        }
      })
    })

    try {
      const content = await unwrap(
        window.api.ai.generateContent({ requestId, topicId: topic.id, sampleIds })
      )
      set((state) => {
        const cur = state.composeSessions[topic.id]
        if (!cur || cur.requestId !== requestId) return state
        const next = {
          ...cur,
          generating: false,
          hasContent: true,
          titleOptions: content.titleOptions,
          primaryIndex: 0,
          body: content.body,
          tagsText: content.tags.join(' '),
          coverCopy: content.coverCopy,
          imageIdeasText: content.imageIdeas.join('\n'),
          error: null
        }
        const version = versionFrom(next, 'generate')
        return {
          composeSessions: {
            ...state.composeSessions,
            [topic.id]: {
              ...next,
              versions: [version, ...cur.versions],
              activeVersionId: version.id
            }
          }
        }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      set((state) => {
        const cur = state.composeSessions[topic.id]
        if (!cur || cur.requestId !== requestId) return state
        return {
          composeSessions: {
            ...state.composeSessions,
            [topic.id]: { ...cur, generating: false, error: message }
          }
        }
      })
      throw e
    } finally {
      off()
    }
  },
  addComposeVersion: (topicId, source, label) => {
    const session = get().composeSessions[topicId]
    if (!session?.hasContent) return null
    const version = versionFrom(session, source, label)
    set((state) => {
      const cur = state.composeSessions[topicId]
      if (!cur) return state
      return {
        composeSessions: {
          ...state.composeSessions,
          [topicId]: {
            ...cur,
            versions: [version, ...cur.versions],
            activeVersionId: version.id
          }
        }
      }
    })
    return version
  },
  restoreComposeVersion: (topicId, versionId) => {
    set((state) => {
      const cur = state.composeSessions[topicId]
      const version = cur?.versions.find((v) => v.id === versionId)
      if (!cur || !version) return state
      return {
        composeSessions: {
          ...state.composeSessions,
          [topicId]: {
            ...applyContent(cur, version.content),
            activeVersionId: version.id
          }
        }
      }
    })
  }
}))
