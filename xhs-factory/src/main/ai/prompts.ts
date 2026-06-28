import type {
  GeneratedContent,
  Persona,
  RevisionSuggestion,
  ViralSample,
  Topic,
  FormulaPattern
} from '@shared/types'

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

function historyBlock(topics: Topic[] = [], formulas: FormulaPattern[] = []): string {
  const parts: string[] = []
  if (topics.length) {
    parts.push(
      `历史高分选题（优先学习方向，不要重复标题）：\n${topics
        .slice(0, 8)
        .map((t) => `- ${t.title}（分数 ${t.score ?? 0}）：${t.rationale || t.hook}`)
        .join('\n')}`
    )
  }
  if (formulas.length) {
    parts.push(
      `已沉淀爆款公式（可复用结构，不要照搬内容）：\n${formulas
        .slice(0, 6)
        .map((f) => `- ${f.name}：钩子=${f.hookType}；结构=${f.structure}；CTA=${f.cta}`)
        .join('\n')}`
    )
  }
  return parts.length ? `\n\n${parts.join('\n\n')}` : ''
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
  highScoreTopics?: Topic[]
  formulas?: FormulaPattern[]
}): string {
  const kw = ctx.keywords ? `\n\n本轮选题方向/关键词：${ctx.keywords}` : ''
  return `${personaBlock(ctx.persona)}${kw}${samplesBlock(ctx.samples)}${historyBlock(
    ctx.highScoreTopics,
    ctx.formulas
  )}

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

function contentBlock(content: GeneratedContent): string {
  return [
    `标题候选：${content.titleOptions.join(' / ')}`,
    `正文：\n${content.body}`,
    `标签：${content.tags.map((t) => `#${t}`).join(' ')}`,
    `封面文案：${content.coverCopy}`,
    `配图建议：${content.imageIdeas.join('；')}`
  ].join('\n\n')
}

export function contentReviewPrompt(ctx: {
  persona: Persona
  topic: Topic
  content: GeneratedContent
}): string {
  return `${personaBlock(ctx.persona)}

请诊断下面这篇小红书笔记，重点看：
- 标题钩子是否足够强
- 开头是否能快速击中痛点
- 正文结构是否清晰、有信息增量
- 语气是否符合账号人设和平台调性
- CTA 是否自然
- 标签和封面文案是否有搜索/点击价值

选题：${ctx.topic.title}
切入角度：${ctx.topic.angle}

当前稿件：
${contentBlock(ctx.content)}

请输出 4~8 条可勾选的修改建议。每条建议必须能直接转化成改写指令。`
}

export function contentRewritePrompt(ctx: {
  persona: Persona
  topic: Topic
  content: GeneratedContent
  suggestions: RevisionSuggestion[]
  customInstruction: string
}): string {
  const selected = ctx.suggestions.length
    ? ctx.suggestions
        .map((s, i) => `${i + 1}. ${s.title}：${s.instruction}（原因：${s.reason}）`)
        .join('\n')
    : '无'
  const custom = ctx.customInstruction.trim() || '无'

  return `${personaBlock(ctx.persona)}

请基于当前稿件进行一次完整改写，而不是重新偏题创作。

选题：${ctx.topic.title}
切入角度：${ctx.topic.angle}
钩子：${ctx.topic.hook}

当前稿件：
${contentBlock(ctx.content)}

用户勾选的修改建议：
${selected}

用户自定义修改要求：
${custom}

改写要求：
- 必须保留原选题方向和核心观点
- 同时满足勾选建议和自定义要求
- 输出完整可发布的小红书笔记内容
- 重新生成 titleOptions、body、tags、coverCopy、imageIdeas
- 正文保持口语化、短句分段、有信息增量，避免空泛套话`
}

export function selectionRewritePrompt(ctx: {
  persona: Persona
  topic: Topic
  content: GeneratedContent
  selectedText: string
  customInstruction: string
}): string {
  return `${personaBlock(ctx.persona)}

请只改写用户选中的这段文字，并保持它能自然放回原文中。不要输出全文，不要解释。

选题：${ctx.topic.title}
切入角度：${ctx.topic.angle}

完整稿件上下文：
${contentBlock(ctx.content)}

选中文本：
${ctx.selectedText}

局部修改要求：
${ctx.customInstruction}

输出要求：
- 只返回替换后的片段
- 保持和上下文语气一致
- 如果用户要求缩短/扩写/更口语化/更专业，严格按要求处理
- 不要添加 Markdown 代码块或额外说明`
}

export function visualPlanPrompt(ctx: {
  persona: Persona
  topic: Topic
  content: GeneratedContent
}): string {
  return `${personaBlock(ctx.persona)}

请基于当前小红书笔记生成一套强相关视觉方案，用于封面图和正文配图。不要给泛泛的氛围图，每张图都必须服务内容表达。

选题：${ctx.topic.title}
切入角度：${ctx.topic.angle}
钩子：${ctx.topic.hook}

当前稿件：
${contentBlock(ctx.content)}

请输出：
1. cover：一个适合小红书首图的封面标题图方案
2. images：3~6 张正文配图方案，优先覆盖痛点场景、对比图、步骤/清单图、结果图、总结图

硬性要求：
- 封面 title ≤ 14 字，subtitle ≤ 18 字
- 每张正文图 textOverlay ≤ 20 字
- prompt 必须能直接给图像模型使用，包含主体、构图、背景、风格、文字区域建议
- 画面主体明确，避免“高级感背景”“抽象氛围”等空泛描述
- 风格适合小红书图文笔记，真实、干净、可读性强
- 不要使用夸张功效承诺或平台敏感表达`
}
