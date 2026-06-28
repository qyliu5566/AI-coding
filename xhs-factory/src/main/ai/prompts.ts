import type { Persona, ViralSample, Topic } from '@shared/types'

// 所有 prompt 模板集中在此，与代码解耦，便于持续迭代。

function personaBlock(p: Persona): string {
  return [
    `账号人设：`,
    `- 名称：${p.name}`,
    p.niche && `- 赛道：${p.niche}`,
    p.tone && `- 语气风格：${p.tone}`,
    p.audience && `- 目标人群：${p.audience}`,
    p.bio && `- 补充设定：${p.bio}`
  ]
    .filter(Boolean)
    .join('\n')
}

function samplesBlock(samples: ViralSample[]): string {
  if (!samples.length) return ''
  const items = samples
    .map((s, i) => {
      const struct = s.structure
        ? `\n  结构拆解：钩子=${s.structure.hook}；开头=${s.structure.opening}；结构=${s.structure.structure}；CTA=${s.structure.cta}`
        : ''
      return `【参考爆款 ${i + 1}】标题：${s.title}\n  正文节选：${s.body.slice(0, 200)}${struct}`
    })
    .join('\n')
  return `\n\n以下是该账号方向的爆款样本，请学习其选题角度与表达结构（不要照抄内容）：\n${items}`
}

export const XHS_SYSTEM = `你是资深的小红书内容操盘手，深谙平台的流量逻辑与用户心理。你的输出要符合小红书调性：
- 标题有钩子、戳痛点或制造好奇，常用数字、对比、悬念、身份认同
- 正文口语化、短句分段、适度使用 emoji，结构为"痛点开头 → 干货/故事 → 行动号召(CTA)"
- 真实、具体、有信息增量，避免空话套话和过度营销腔
- 自然融入可被搜索的关键词`

export function topicsPrompt(ctx: {
  persona: Persona
  keywords: string
  count: number
  samples: ViralSample[]
}): string {
  const kw = ctx.keywords ? `\n\n本轮选题方向/关键词：${ctx.keywords}` : ''
  return `${personaBlock(ctx.persona)}${kw}${samplesBlock(ctx.samples)}

请为这个账号产出 ${ctx.count} 个**互不重复**、有爆款潜质的小红书选题。每个选题包含：
- title：选题标题方向（一句话，可直接作为笔记标题的雏形）
- angle：切入角度（为什么从这个角度切）
- hook：核心钩子（一句话说明它如何抓住用户）
- rationale：为什么可能爆（结合人群痛点/平台趋势简述）

只输出结构化结果，不要额外说明。`
}

export function contentBodyPrompt(ctx: {
  persona: Persona
  topic: Topic
  samples: ViralSample[]
}): string {
  return `${personaBlock(ctx.persona)}${samplesBlock(ctx.samples)}

请基于以下选题，写一篇完整的小红书笔记**正文**（不要写标题、不要写标签、不要任何前后说明，直接输出正文本身）：
- 选题：${ctx.topic.title}
- 切入角度：${ctx.topic.angle}
- 钩子：${ctx.topic.hook}

要求：口语化、短句分段、恰当 emoji，痛点开头 + 干货/干货清单 + 结尾 CTA，整体 300~600 字。`
}

export function contentMetaPrompt(ctx: { topic: Topic; body: string }): string {
  return `这是一篇小红书笔记的选题与正文：
选题：${ctx.topic.title}

正文：
${ctx.body}

请为这篇笔记生成配套元素：
- titleOptions：3~5 个不同风格的标题（钩子型/数字型/悬念型等），每个 ≤ 20 字
- tags：6~10 个小红书话题标签（不带 # 号，含可被搜索的关键词）
- coverCopy：封面文案（≤ 15 字，强吸引点击）
- imageIdeas：3~5 条配图建议（每条说明拍/做什么图）`
}

export function viralAnalyzePrompt(input: { title: string; body: string }): string {
  return `请拆解这篇小红书爆款笔记的结构，便于复用其套路：
标题：${input.title}

正文：
${input.body}

输出四部分：
- hook：标题/开头用了什么钩子
- opening：开头是如何抓住读者的
- structure：正文的整体结构脉络
- cta：结尾的行动号召方式`
}
