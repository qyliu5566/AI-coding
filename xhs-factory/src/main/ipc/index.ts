import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC, type IpcResult, type ContentChunkEvent } from '@shared/types'
import * as personas from '../services/personaService'
import * as topics from '../services/topicService'
import * as drafts from '../services/draftService'
import * as viral from '../services/viralService'
import * as settings from '../services/settingsService'
import * as exporter from '../services/exportService'
import { generateContent } from '../services/contentService'
import { hasApiKey, setApiKey } from '../secrets'
import { getDb, schema } from '../db/client'
import { eq } from 'drizzle-orm'

function toError(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

// 统一包装：handler 只写业务，错误自动转成 { ok:false, error }
function handle<T>(
  channel: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 通用分发器需兼容各 handler 的不同参数签名
  fn: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T> | T
): void {
  ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<T>> => {
    try {
      return { ok: true, data: await fn(event, ...args) }
    } catch (e) {
      return { ok: false, error: toError(e) }
    }
  })
}

export function registerIpc(): void {
  // ---- 人设 ----
  handle(IPC.persona.list, () => personas.listPersonas())
  handle(IPC.persona.create, (_e, input) => personas.createPersona(input))
  handle(IPC.persona.update, (_e, id: number, input) => personas.updatePersona(id, input))
  handle(IPC.persona.remove, (_e, id: number) => personas.removePersona(id))

  // ---- 选题 ----
  handle(IPC.topic.list, (_e, personaId?: number) => topics.listTopics(personaId))
  handle(IPC.topic.get, (_e, id: number) => topics.getTopic(id))
  handle(IPC.topic.generate, (_e, input) => topics.generateTopics(input))
  handle(IPC.topic.create, (_e, input) => topics.createTopic(input))
  handle(IPC.topic.setStatus, (_e, id: number, status) => topics.setStatus(id, status))
  handle(IPC.topic.remove, (_e, id: number) => topics.removeTopic(id))

  // ---- 草稿 ----
  handle(IPC.draft.list, () => drafts.listDrafts())
  handle(IPC.draft.get, (_e, id: number) => drafts.getDraft(id))
  handle(IPC.draft.create, (_e, input) => drafts.createDraft(input))
  handle(IPC.draft.update, (_e, id: number, patch) => drafts.updateDraft(id, patch))
  handle(IPC.draft.remove, (_e, id: number) => drafts.removeDraft(id))

  // ---- 爆款样本 ----
  handle(IPC.viral.list, () => viral.listSamples())
  handle(IPC.viral.create, (_e, input) => viral.createSample(input))
  handle(IPC.viral.remove, (_e, id: number) => viral.removeSample(id))
  handle(IPC.viral.analyze, (_e, id: number) => viral.analyzeSample(id))

  // ---- 设置 ----
  handle(IPC.settings.get, () => settings.getSettings())
  handle(IPC.settings.set, (_e, input) => settings.setSettings(input))
  handle(IPC.settings.getApiKey, (_e, provider) => hasApiKey(provider))
  handle(IPC.settings.setApiKey, (_e, provider, key: string) => {
    setApiKey(provider, key)
    return hasApiKey(provider)
  })

  // ---- 导出 ----
  handle(IPC.exporter.copy, (_e, text: string) => {
    exporter.copyToClipboard(text)
    return true
  })
  handle(IPC.exporter.markdown, (_e, draftId: number) => {
    const draft = getDb().select().from(schema.drafts).where(eq(schema.drafts.id, draftId)).get()
    if (!draft) throw new Error('草稿不存在')
    return exporter.exportMarkdown(draft)
  })

  // ---- AI 创作（流式正文）----
  handle(
    IPC.ai.generateContent,
    async (event, payload: { requestId: string; topicId: number; sampleIds?: number[] }) => {
      const { requestId, ...rest } = payload
      return generateContent(rest, (delta) => {
        const ev: ContentChunkEvent = { requestId, delta }
        if (!event.sender.isDestroyed()) event.sender.send(IPC.ai.contentChunk, ev)
      })
    }
  )
}
