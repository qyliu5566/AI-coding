import type { AIProvider } from './provider'
import { ClaudeProvider } from './claude'
import { OpenAICompatProvider } from './openaiCompat'
import { getSettings } from '../services/settingsService'
import { getApiKey } from '../secrets'

// 工厂：按当前设置 + 已存密钥构造 Provider。
// 新增模型只需在这里加一个分支 + 一个实现文件。
export function getProvider(): AIProvider {
  const { provider, model } = getSettings()
  const apiKey = getApiKey(provider)
  if (!apiKey) throw new Error('尚未配置该模型的 API Key，请先到「设置」填写')

  switch (provider) {
    case 'claude':
      return new ClaudeProvider({ apiKey, model })
    case 'deepseek':
      return new OpenAICompatProvider({
        id: 'deepseek',
        apiKey,
        model,
        baseURL: 'https://api.deepseek.com'
      })
    case 'openai':
      return new OpenAICompatProvider({ id: 'openai', apiKey, model })
    default:
      throw new Error(`暂不支持的模型提供方：${provider}`)
  }
}

export type { AIProvider }
