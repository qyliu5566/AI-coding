import type { IpcResult } from '@shared/types'

// 统一解包 IPC 返回：失败抛错（由调用方 try/catch + toast 处理），成功返回数据。
export async function unwrap<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}
