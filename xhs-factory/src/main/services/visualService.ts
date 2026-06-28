import { z } from 'zod'
import { app } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import OpenAI from 'openai'
import type {
  AppSettings,
  GenerateImageInput,
  GeneratedImageAsset,
  GenerateVisualPlanInput,
  VisualPlan
} from '@shared/types'
import { getTopic } from './topicService'
import { getPersona } from './personaService'
import { getSettings } from './settingsService'
import { getProvider } from '../ai'
import { getApiKey } from '../secrets'

const contentSchema = z.object({
  titleOptions: z.array(z.string()).default([]),
  body: z.string().default(''),
  tags: z.array(z.string()).default([]),
  coverCopy: z.string().default(''),
  imageIdeas: z.array(z.string()).default([])
})

const input = z.object({
  topicId: z.number().int(),
  content: contentSchema
})

const imageInput = z.object({
  prompt: z.string().min(1, '图片 Prompt 不能为空'),
  kind: z.enum(['cover', 'content']),
  planId: z.string().min(1),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', '2K']).optional()
})

interface VolcengineImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>
}

export async function generateVisualPlan(raw: GenerateVisualPlanInput): Promise<VisualPlan> {
  const { topicId, content } = input.parse(raw)
  if (!content.body.trim()) throw new Error('请先生成或填写正文')
  const topic = getTopic(topicId)
  if (!topic) throw new Error('选题不存在')
  const persona = getPersona(topic.personaId)
  if (!persona) throw new Error('选题对应的人设已被删除')
  return getProvider().generateVisualPlan({ persona, topic, content })
}

export async function generateImage(raw: GenerateImageInput): Promise<GeneratedImageAsset> {
  const data = imageInput.parse(raw)
  const settings = getSettings()
  const apiKey = getApiKey(`image:${settings.imageProvider}`)
  if (!apiKey) throw new Error('尚未配置视觉模型 API Key，请先到「设置」填写')

  const model = settings.imageModel
  const size = resolveImageSize(settings, data.size)
  const bytes =
    settings.imageProvider === 'volcengine'
      ? await generateVolcengineImage({ apiKey, model, prompt: data.prompt, size })
      : await generateOpenAIImage({ apiKey, model, prompt: data.prompt, size })

  const createdAt = Date.now()
  const id = `${data.kind}-${data.planId}-${createdAt}`
  const dir = join(app.getPath('userData'), 'assets', 'images')
  mkdirSync(dir, { recursive: true })
  const localPath = join(dir, `${id}.png`)
  writeFileSync(localPath, bytes)

  return {
    id,
    planId: data.planId,
    kind: data.kind,
    localPath,
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
    prompt: data.prompt,
    model,
    size,
    createdAt
  }
}

function resolveImageSize(
  settings: AppSettings,
  requested?: AppSettings['imageSize']
): AppSettings['imageSize'] {
  const size = requested ?? settings.imageSize
  if (settings.imageProvider === 'volcengine' && size !== '2K') return '2K'
  return size
}

async function generateOpenAIImage(input: {
  apiKey: string
  model: string
  prompt: string
  size: AppSettings['imageSize']
}): Promise<Buffer> {
  if (input.size === '2K') throw new Error('OpenAI Images 不支持 2K 尺寸，请在设置中选择标准尺寸')
  const client = new OpenAI({ apiKey: input.apiKey })
  const params: OpenAI.Images.ImageGenerateParamsNonStreaming = {
    model: input.model,
    prompt: input.prompt,
    n: 1,
    size: input.size,
    ...(input.model.startsWith('dall-e')
      ? { response_format: 'b64_json' as const }
      : { output_format: 'png' as const })
  }
  const res = await client.images.generate(params)
  return imageResponseToBuffer(res.data?.[0])
}

async function generateVolcengineImage(input: {
  apiKey: string
  model: string
  prompt: string
  size: AppSettings['imageSize']
}): Promise<Buffer> {
  const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      sequential_image_generation: 'disabled',
      response_format: 'url',
      size: '2K',
      stream: false,
      watermark: true
    })
  })
  if (!res.ok) {
    const message = await res.text().catch(() => '')
    throw new Error(`火山引擎图片生成失败：${res.status} ${message}`)
  }
  const json = (await res.json()) as VolcengineImageResponse
  return imageResponseToBuffer(json.data?.[0])
}

async function imageResponseToBuffer(image?: { b64_json?: string; url?: string }): Promise<Buffer> {
  if (!image) throw new Error('视觉模型未返回图片')
  if (image.b64_json) return Buffer.from(image.b64_json, 'base64')
  if (image.url) {
    const fetched = await fetch(image.url)
    if (!fetched.ok) throw new Error('图片下载失败')
    return Buffer.from(await fetched.arrayBuffer())
  }
  throw new Error('视觉模型返回格式不支持')
}
