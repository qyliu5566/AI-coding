import { clipboard, dialog } from 'electron'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import type { Draft, GeneratedImageAsset } from '@shared/types'

interface ExportedAsset {
  asset: GeneratedImageAsset
  label: string
  relativePath: string | null
  missing: boolean
}

function safeName(input: string): string {
  return (
    input
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim() || 'xhs-note'
  )
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function sortedAssets(draft: Draft): GeneratedImageAsset[] {
  return Object.values(draft.imageAssets).sort((a, b) =>
    a.kind === b.kind ? a.createdAt - b.createdAt : a.kind === 'cover' ? -1 : 1
  )
}

export function draftToMarkdown(draft: Draft, exportedAssets?: ExportedAsset[]): string {
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
  if (draft.visualPlan) {
    lines.push('## 视觉方案', '')
    lines.push('### 封面图', '')
    lines.push(`- 标题：${draft.visualPlan.cover.title}`)
    lines.push(`- 副标题：${draft.visualPlan.cover.subtitle}`)
    lines.push(`- 版式：${draft.visualPlan.cover.layout}`)
    lines.push(`- 风格：${draft.visualPlan.cover.style}`)
    lines.push(`- 色彩：${draft.visualPlan.cover.colorPalette}`)
    if (draft.visualPlan.cover.elements.length) {
      lines.push(`- 元素：${draft.visualPlan.cover.elements.join('、')}`)
    }
    lines.push('', '```text', draft.visualPlan.cover.prompt, '```', '')
    if (draft.visualPlan.images.length) {
      lines.push('### 正文配图', '')
      draft.visualPlan.images.forEach((image, index) => {
        lines.push(`#### 配图 ${index + 1}：${image.purpose}`, '')
        lines.push(`- 画面：${image.scene}`)
        lines.push(`- 构图：${image.composition}`)
        lines.push(`- 风格：${image.style}`)
        if (image.textOverlay) lines.push(`- 叠字：${image.textOverlay}`)
        lines.push('', '```text', image.prompt, '```', '')
      })
    }
  }
  const assets =
    exportedAssets ??
    sortedAssets(draft).map((asset, index) => ({
      asset,
      label: asset.kind === 'cover' ? '封面图' : `正文配图 ${index}`,
      relativePath: asset.localPath,
      missing: false
    }))
  if (assets.length) {
    lines.push('## 已生成图片', '')
    assets.forEach(({ asset, label, relativePath, missing }) => {
      lines.push(`### ${label}`, '')
      if (missing || !relativePath) lines.push(`> 图片文件缺失：${asset.localPath}`, '')
      else lines.push(`![${label}](${relativePath})`, '')
      lines.push(`- 原始路径：${asset.localPath}`)
      lines.push(`- 模型：${asset.model}`)
      lines.push(`- 尺寸：${asset.size}`)
      lines.push('', '```text', asset.prompt, '```', '')
    })
  }
  return lines.join('\n')
}

export function copyToClipboard(text: string): void {
  clipboard.writeText(text)
}

export async function exportMarkdown(
  draft: Draft
): Promise<{ saved: boolean; folderPath?: string; markdownPath?: string }> {
  const title = safeName(draft.titleOptions[0] ?? 'xhs-note')
  const res = await dialog.showOpenDialog({
    title: '选择稿件资料包导出目录',
    properties: ['openDirectory', 'createDirectory']
  })
  if (res.canceled || !res.filePaths[0]) return { saved: false }

  const folderPath = join(res.filePaths[0], `${title}_draft-${draft.id}_${timestamp()}`)
  const imagesDir = join(folderPath, 'images')
  mkdirSync(imagesDir, { recursive: true })

  const missing: string[] = []
  let contentIndex = 0
  const exportedAssets: ExportedAsset[] = sortedAssets(draft).map((asset) => {
    const ext = extname(asset.localPath) || '.png'
    const fileName =
      asset.kind === 'cover'
        ? `cover${ext}`
        : `content-${String(++contentIndex).padStart(2, '0')}${ext}`
    const label = asset.kind === 'cover' ? '封面图' : `正文配图 ${contentIndex}`
    const target = join(imagesDir, fileName)
    if (!existsSync(asset.localPath)) {
      missing.push(`${label}: ${asset.localPath}`)
      return { asset, label, relativePath: null, missing: true }
    }
    copyFileSync(asset.localPath, target)
    return { asset, label, relativePath: `images/${basename(target)}`, missing: false }
  })

  if (draft.visualPlan) {
    writeFileSync(
      join(folderPath, 'visual-plan.json'),
      JSON.stringify(draft.visualPlan, null, 2),
      'utf-8'
    )
  }
  if (missing.length) {
    writeFileSync(join(folderPath, 'missing-assets.txt'), missing.join('\n'), 'utf-8')
  }
  const markdownPath = join(folderPath, '稿件.md')
  writeFileSync(markdownPath, draftToMarkdown(draft, exportedAssets), 'utf-8')
  return { saved: true, folderPath, markdownPath }
}
