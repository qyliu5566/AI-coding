import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC, type ContentChunkEvent } from '@shared/types'

const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
  ipcRenderer.invoke(channel, ...args)

// 白名单 API：渲染进程只能通过这里访问主进程能力
const api = {
  persona: {
    list: () => invoke(IPC.persona.list),
    create: (input: unknown) => invoke(IPC.persona.create, input),
    update: (id: number, input: unknown) => invoke(IPC.persona.update, id, input),
    remove: (id: number) => invoke(IPC.persona.remove, id)
  },
  topic: {
    list: (personaId?: number) => invoke(IPC.topic.list, personaId),
    get: (id: number) => invoke(IPC.topic.get, id),
    generate: (input: unknown) => invoke(IPC.topic.generate, input),
    create: (input: unknown) => invoke(IPC.topic.create, input),
    setStatus: (id: number, status: string) => invoke(IPC.topic.setStatus, id, status),
    remove: (id: number) => invoke(IPC.topic.remove, id)
  },
  draft: {
    list: () => invoke(IPC.draft.list),
    get: (id: number) => invoke(IPC.draft.get, id),
    create: (input: unknown) => invoke(IPC.draft.create, input),
    update: (id: number, patch: unknown) => invoke(IPC.draft.update, id, patch),
    remove: (id: number) => invoke(IPC.draft.remove, id)
  },
  viral: {
    list: () => invoke(IPC.viral.list),
    create: (input: unknown) => invoke(IPC.viral.create, input),
    createBatch: (input: unknown) => invoke(IPC.viral.createBatch, input),
    remove: (id: number) => invoke(IPC.viral.remove, id),
    analyze: (id: number) => invoke(IPC.viral.analyze, id)
  },
  publish: {
    list: (filters?: unknown) => invoke(IPC.publish.list, filters),
    create: (input: unknown) => invoke(IPC.publish.create, input),
    update: (id: number, patch: unknown) => invoke(IPC.publish.update, id, patch),
    remove: (id: number) => invoke(IPC.publish.remove, id),
    updateMetrics: (id: number, metrics: unknown) => invoke(IPC.publish.updateMetrics, id, metrics),
    review: (id: number) => invoke(IPC.publish.review, id)
  },
  analytics: {
    overview: () => invoke(IPC.analytics.overview),
    persona: () => invoke(IPC.analytics.persona),
    topicTags: () => invoke(IPC.analytics.topicTags),
    formulas: () => invoke(IPC.analytics.formulas)
  },
  formula: {
    list: (personaId?: number) => invoke(IPC.formula.list, personaId),
    create: (input: unknown) => invoke(IPC.formula.create, input),
    createFromSample: (sampleId: number) => invoke(IPC.formula.createFromSample, sampleId),
    createFromDraft: (draftId: number) => invoke(IPC.formula.createFromDraft, draftId),
    remove: (id: number) => invoke(IPC.formula.remove, id)
  },
  compliance: {
    check: (input: unknown) => invoke(IPC.compliance.check, input)
  },
  settings: {
    get: () => invoke(IPC.settings.get),
    set: (input: unknown) => invoke(IPC.settings.set, input),
    getApiKey: (provider: string) => invoke(IPC.settings.getApiKey, provider),
    setApiKey: (provider: string, key: string) => invoke(IPC.settings.setApiKey, provider, key)
  },
  exporter: {
    copy: (text: string) => invoke(IPC.exporter.copy, text),
    markdown: (draftId: number) => invoke(IPC.exporter.markdown, draftId)
  },
  asset: {
    imageDataUrl: (localPath: string) => invoke(IPC.asset.imageDataUrl, localPath)
  },
  ai: {
    generateContent: (input: { requestId: string; topicId: number; sampleIds?: number[] }) =>
      invoke(IPC.ai.generateContent, input),
    reviewContent: (input: unknown) => invoke(IPC.ai.reviewContent, input),
    rewriteContent: (input: unknown) => invoke(IPC.ai.rewriteContent, input),
    rewriteSelection: (input: unknown) => invoke(IPC.ai.rewriteSelection, input),
    generateVisualPlan: (input: unknown) => invoke(IPC.ai.generateVisualPlan, input),
    generateImage: (input: unknown) => invoke(IPC.ai.generateImage, input),
    // 订阅流式正文增量，返回取消订阅函数
    onContentChunk: (cb: (e: ContentChunkEvent) => void): (() => void) => {
      const listener = (_: unknown, payload: ContentChunkEvent): void => cb(payload)
      ipcRenderer.on(IPC.ai.contentChunk, listener)
      return () => ipcRenderer.removeListener(IPC.ai.contentChunk, listener)
    }
  }
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
