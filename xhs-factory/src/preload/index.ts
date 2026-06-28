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
    remove: (id: number) => invoke(IPC.viral.remove, id),
    analyze: (id: number) => invoke(IPC.viral.analyze, id)
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
  ai: {
    generateContent: (input: { requestId: string; topicId: number; sampleIds?: number[] }) =>
      invoke(IPC.ai.generateContent, input),
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
