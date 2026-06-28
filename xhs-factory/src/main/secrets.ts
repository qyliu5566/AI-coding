import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { ProviderId } from '@shared/types'

// API key 用系统级加密(safeStorage)后存本地文件,绝不入库、不进渲染进程、不进 git。
// 文件格式: { [provider]: <base64 加密串> }

const file = (): string => join(app.getPath('userData'), 'secrets.json')

function readAll(): Record<string, string> {
  try {
    if (!existsSync(file())) return {}
    return JSON.parse(readFileSync(file(), 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, string>): void {
  writeFileSync(file(), JSON.stringify(data), { encoding: 'utf-8', mode: 0o600 })
}

export function setApiKey(provider: ProviderId, key: string): void {
  const all = readAll()
  if (!key) {
    delete all[provider]
  } else if (safeStorage.isEncryptionAvailable()) {
    all[provider] = safeStorage.encryptString(key).toString('base64')
  } else {
    // 系统加密不可用时退化为明文(仍仅本地、0600)。生产环境应保证加密可用。
    all[provider] = 'plain:' + Buffer.from(key, 'utf-8').toString('base64')
  }
  writeAll(all)
}

export function getApiKey(provider: ProviderId): string | null {
  const raw = readAll()[provider]
  if (!raw) return null
  try {
    if (raw.startsWith('plain:')) return Buffer.from(raw.slice(6), 'base64').toString('utf-8')
    return safeStorage.decryptString(Buffer.from(raw, 'base64'))
  } catch {
    return null
  }
}

export function hasApiKey(provider: ProviderId): boolean {
  return !!readAll()[provider]
}
