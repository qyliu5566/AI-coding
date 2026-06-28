import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { extname, join, relative, resolve } from 'path'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

function imageRoot(): string {
  return resolve(join(app.getPath('userData'), 'assets', 'images'))
}

function assertInsideImageRoot(path: string): string {
  const resolved = resolve(path)
  const rel = relative(imageRoot(), resolved)
  if (rel.startsWith('..') || rel === '' || rel.includes('..') || resolve(rel) === rel) {
    throw new Error('图片路径不在应用图片目录内')
  }
  return resolved
}

export function imageDataUrl(localPath: string): string {
  const resolved = assertInsideImageRoot(localPath)
  if (!existsSync(resolved)) throw new Error('图片文件不存在')
  const mime = MIME_BY_EXT[extname(resolved).toLowerCase()] ?? 'image/png'
  return `data:${mime};base64,${readFileSync(resolved).toString('base64')}`
}
