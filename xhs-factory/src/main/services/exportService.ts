import { clipboard, dialog } from 'electron'
import { writeFileSync } from 'fs'
import type { Draft } from '@shared/types'

export function draftToMarkdown(draft: Draft): string {
  const title = draft.titleOptions[0] ?? '(未命名)'
  const lines: string[] = [`# ${title}`, '']
  if (draft.titleOptions.length > 1) {
    lines.push('## 备选标题')
    draft.titleOptions.forEach((t, i) => lines.push(`${i + 1}. ${t}`))
    lines.push('')
  }
  lines.push('## 正文', '', draft.body, '')
  if (draft.coverCopy) lines.push('## 封面文案', '', draft.coverCopy, '')
  if (draft.tags.length) lines.push('## 标签', '', draft.tags.map((t) => `#${t}`).join(' '), '')
  if (draft.imageIdeas.length) {
    lines.push('## 配图建议', '')
    draft.imageIdeas.forEach((idea) => lines.push(`- ${idea}`))
    lines.push('')
  }
  return lines.join('\n')
}

export function copyToClipboard(text: string): void {
  clipboard.writeText(text)
}

export async function exportMarkdown(draft: Draft): Promise<{ saved: boolean; path?: string }> {
  const suggested = (draft.titleOptions[0] ?? 'xhs-note').replace(/[\\/:*?"<>|]/g, '_')
  const res = await dialog.showSaveDialog({
    title: '导出 Markdown',
    defaultPath: `${suggested}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (res.canceled || !res.filePath) return { saved: false }
  writeFileSync(res.filePath, draftToMarkdown(draft), 'utf-8')
  return { saved: true, path: res.filePath }
}
