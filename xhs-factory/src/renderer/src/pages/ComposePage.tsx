import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Sparkles,
  Copy,
  Save,
  PenLine,
  ChevronDown,
  Flame,
  Wand2,
  RefreshCw,
  History,
  Scissors,
  BookmarkPlus,
  MessageCircle,
  Minimize2,
  Maximize2,
  ListPlus,
  HeartHandshake,
  Image,
  Palette,
  ClipboardList,
  Trash2,
  Loader2,
  Lightbulb
} from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { unwrap } from '@/lib/ipc'
import { useAppStore } from '@/store/app'
import type { GeneratedContent, Topic, ViralSample, VisualPlan } from '@shared/types'

function splitTags(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\s,，#]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    )
  )
}
function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^[-•\s]+/, '').trim())
    .filter(Boolean)
}

const QUICK_REWRITE_ACTIONS = [
  {
    key: 'casual',
    label: '口语化',
    icon: MessageCircle,
    instruction: '把选中文本改得更口语化、更像小红书真人分享，保留原意。'
  },
  {
    key: 'shorten',
    label: '缩短',
    icon: Minimize2,
    instruction: '将选中文本压缩到原长度的 50%-70%，保留核心信息和小红书语气。'
  },
  {
    key: 'expand',
    label: '扩写',
    icon: Maximize2,
    instruction: '适度扩写选中文本，增加具体解释和信息量，不要空泛。'
  },
  {
    key: 'example',
    label: '加案例',
    icon: ListPlus,
    instruction: '为选中文本补充一个具体、真实感强的小例子。'
  },
  {
    key: 'selling',
    label: '更种草',
    icon: HeartHandshake,
    instruction: '让选中文本更有种草感，但避免过度营销和夸张承诺。'
  }
] as const

type QueueState = 'generating' | 'unsaved' | 'selected'

const QUEUE_LABEL: Record<QueueState, string> = {
  generating: '生成中',
  unsaved: '草稿未保存',
  selected: '已选用'
}

const QUEUE_RANK: Record<QueueState, number> = {
  generating: 0,
  unsaved: 1,
  selected: 2
}

export default function ComposePage(): React.JSX.Element {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const personas = useAppStore((s) => s.personas)
  const selectedPersonaId = useAppStore((s) => s.selectedPersonaId)
  const selectPersona = useAppStore((s) => s.selectPersona)
  const composeSessions = useAppStore((s) => s.composeSessions)
  const session = useAppStore((s) => (topicId ? s.composeSessions[Number(topicId)] : undefined))
  const ensureComposeSession = useAppStore((s) => s.ensureComposeSession)
  const generateContent = useAppStore((s) => s.generateContent)
  const updateComposeSession = useAppStore((s) => s.updateComposeSession)
  const clearComposeSession = useAppStore((s) => s.clearComposeSession)
  const addComposeVersion = useAppStore((s) => s.addComposeVersion)
  const restoreComposeVersion = useAppStore((s) => s.restoreComposeVersion)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  const [topic, setTopic] = useState<Topic | null>(session?.topic ?? null)
  const [loading, setLoading] = useState(false)
  const [queueLoading, setQueueLoading] = useState(false)
  const [topics, setTopics] = useState<Topic[]>([])
  const [samples, setSamples] = useState<ViralSample[]>([])

  const [saving, setSaving] = useState(false)

  const persona = useMemo(
    () => personas.find((p) => p.id === topic?.personaId) ?? null,
    [personas, topic]
  )
  const selectedPersona = useMemo(
    () => personas.find((p) => p.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId]
  )

  useEffect(() => {
    void (async () => {
      if (!topicId) {
        setTopic(null)
        return
      }
      const id = Number(topicId)
      if (session?.topicId === id) {
        setTopic(session.topic)
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const loaded = await unwrap(window.api.topic.get(id))
        setTopic(loaded)
        if (loaded) ensureComposeSession(loaded)
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [topicId, session?.topicId, session?.topic, ensureComposeSession])

  useEffect(() => {
    void (async () => {
      try {
        setSamples(await unwrap(window.api.viral.list()))
      } catch {
        /* 忽略 */
      }
    })()
  }, [])

  useEffect(() => {
    if (topicId) return
    if (selectedPersonaId == null) {
      setTopics([])
      return
    }
    void (async () => {
      setQueueLoading(true)
      try {
        setTopics(await unwrap(window.api.topic.list(selectedPersonaId)))
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setQueueLoading(false)
      }
    })()
  }, [topicId, selectedPersonaId])

  const getQueueState = useCallback(
    (t: Topic): QueueState | null => {
      if (t.status === 'written' || t.status === 'published') return null
      const cur = composeSessions[t.id]
      if (cur?.generating) return 'generating'
      if (cur?.hasContent) return 'unsaved'
      if (t.status === 'selected') return 'selected'
      return null
    },
    [composeSessions]
  )

  const queueItems = useMemo(() => {
    const byId = new Map<number, Topic>()
    topics.forEach((item) => byId.set(item.id, item))
    Object.values(composeSessions).forEach((item) => {
      if (selectedPersonaId == null || item.topic.personaId !== selectedPersonaId) return
      if (!byId.has(item.topic.id)) byId.set(item.topic.id, item.topic)
    })

    return Array.from(byId.values())
      .map((item) => ({ topic: item, queueState: getQueueState(item) }))
      .filter((item): item is { topic: Topic; queueState: QueueState } => item.queueState != null)
      .sort((a, b) => {
        const byState = QUEUE_RANK[a.queueState] - QUEUE_RANK[b.queueState]
        if (byState !== 0) return byState
        return b.topic.createdAt - a.topic.createdAt || b.topic.id - a.topic.id
      })
  }, [topics, composeSessions, selectedPersonaId, getQueueState])

  const sampleIds = session?.sampleIds ?? []
  const showSamples = session?.showSamples ?? false
  const generating = session?.generating ?? false
  const hasContent = session?.hasContent ?? false
  const titleOptions = session?.titleOptions ?? []
  const primaryIndex = session?.primaryIndex ?? 0
  const body = session?.body ?? ''
  const tagsText = session?.tagsText ?? ''
  const coverCopy = session?.coverCopy ?? ''
  const imageIdeasText = session?.imageIdeasText ?? ''
  const versions = session?.versions ?? []
  const activeVersionId = session?.activeVersionId ?? null
  const visualPlan = session?.visualPlan ?? null
  const imageAssets = session?.imageAssets ?? {}
  const draftId = session?.draftId ?? null
  const review = session?.review ?? null
  const selectedSuggestionIds = session?.selectedSuggestionIds ?? []
  const customInstruction = session?.customInstruction ?? ''
  const selectionInstruction = session?.selectionInstruction ?? ''
  const customSelectionOpen = session?.customSelectionOpen ?? false
  const bodySelection = session?.bodySelection ?? { start: 0, end: 0, text: '' }
  const reviewing = session?.reviewing ?? false
  const rewriting = session?.rewriting ?? false
  const rewritingSelection = session?.rewritingSelection ?? false
  const visualGenerating = session?.visualGenerating ?? false
  const generatingImageKey = session?.generatingImageKey ?? null

  const patchSession = (patch: Parameters<typeof updateComposeSession>[1]): void => {
    if (!topic) return
    updateComposeSession(topic.id, patch)
  }

  const toggleSample = (id: number): void => {
    const next = sampleIds.includes(id) ? sampleIds.filter((x) => x !== id) : [...sampleIds, id]
    patchSession({ sampleIds: next })
  }

  const currentContent = (): GeneratedContent => ({
    titleOptions,
    body,
    tags: splitTags(tagsText),
    coverCopy,
    imageIdeas: splitLines(imageIdeasText)
  })

  const generate = async (): Promise<void> => {
    if (!topic) return
    try {
      await generateContent(topic, sampleIds)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const save = async (): Promise<void> => {
    if (!topic) return
    const titles = titleOptions.map((t) => t.trim()).filter(Boolean)
    const ordered =
      titles.length > 0
        ? [titles[primaryIndex] ?? titles[0], ...titles.filter((_, i) => i !== primaryIndex)]
        : []
    const storedImageAssets = Object.fromEntries(
      Object.entries(imageAssets).map(([key, asset]) => [
        key,
        {
          id: asset.id,
          planId: asset.planId,
          kind: asset.kind,
          localPath: asset.localPath,
          prompt: asset.prompt,
          model: asset.model,
          size: asset.size,
          createdAt: asset.createdAt
        }
      ])
    )
    setSaving(true)
    try {
      const payload = {
        titleOptions: ordered,
        body: body.trim(),
        tags: splitTags(tagsText),
        coverCopy: coverCopy.trim(),
        imageIdeas: splitLines(imageIdeasText),
        visualPlan,
        imageAssets: storedImageAssets,
        status: 'draft' as const
      }
      const draft =
        draftId != null
          ? await unwrap(window.api.draft.update(draftId, payload))
          : await unwrap(
              window.api.draft.create({
                topicId: topic.id,
                personaId: topic.personaId,
                ...payload
              })
            )
      await window.api.topic.setStatus(topic.id, 'written')
      toast.success(draftId != null ? '已更新草稿' : '已保存到草稿库')
      clearComposeSession(topic.id)
      navigate(`/drafts?focus=${draft.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const copyBody = async (): Promise<void> => {
    await window.api.exporter.copy(body)
    toast.success('正文已复制')
  }

  const runReview = async (): Promise<void> => {
    if (!topic) return
    patchSession({ reviewing: true })
    try {
      const result = await unwrap(
        window.api.ai.reviewContent({ topicId: topic.id, currentContent: currentContent() })
      )
      patchSession({ review: result, selectedSuggestionIds: [] })
      toast.success('诊断完成')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      patchSession({ reviewing: false })
    }
  }

  const toggleSuggestion = (id: string): void => {
    const next = selectedSuggestionIds.includes(id)
      ? selectedSuggestionIds.filter((x) => x !== id)
      : [...selectedSuggestionIds, id]
    patchSession({ selectedSuggestionIds: next })
  }

  const rewrite = async (): Promise<void> => {
    if (!topic) return
    patchSession({ rewriting: true })
    try {
      const rewritten = await unwrap(
        window.api.ai.rewriteContent({
          topicId: topic.id,
          currentContent: currentContent(),
          suggestions: review?.suggestions ?? [],
          selectedSuggestionIds,
          customInstruction
        })
      )
      patchSession({
        hasContent: true,
        titleOptions: rewritten.titleOptions,
        primaryIndex: 0,
        body: rewritten.body,
        tagsText: rewritten.tags.join(' '),
        coverCopy: rewritten.coverCopy,
        imageIdeasText: rewritten.imageIdeas.join('\n')
      })
      addComposeVersion(topic.id, 'rewrite')
      toast.success('已生成改写版本')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      patchSession({ rewriting: false })
    }
  }

  const refreshSelection = (): void => {
    const el = bodyRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    patchSession({ bodySelection: { start, end, text: start < end ? body.slice(start, end) : '' } })
  }

  const saveCurrentVersion = (): void => {
    if (!topic) return
    const version = addComposeVersion(topic.id, 'manual')
    if (version) toast.success('已保存当前版本')
  }

  const restoreVersion = (versionId: string): void => {
    if (!topic) return
    restoreComposeVersion(topic.id, versionId)
    toast.success('已恢复版本')
  }

  const rewriteSelectedText = async (instruction: string): Promise<void> => {
    if (!topic) return
    if (!bodySelection.text.trim()) {
      toast.error('请先在正文里选中要改写的片段')
      return
    }
    if (!instruction.trim()) {
      toast.error('请填写局部修改要求')
      return
    }
    patchSession({ rewritingSelection: true })
    try {
      const replacement = await unwrap(
        window.api.ai.rewriteSelection({
          topicId: topic.id,
          currentContent: currentContent(),
          selectedText: bodySelection.text,
          customInstruction: instruction
        })
      )
      const nextBody =
        body.slice(0, bodySelection.start) + replacement + body.slice(bodySelection.end)
      patchSession({ body: nextBody })
      addComposeVersion(topic.id, 'selection')
      patchSession({
        bodySelection: { start: 0, end: 0, text: '' },
        selectionInstruction: '',
        customSelectionOpen: false
      })
      toast.success('已完成局部改写')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      patchSession({ rewritingSelection: false })
    }
  }

  const generateVisualPlan = async (): Promise<void> => {
    if (!topic) return
    patchSession({ visualGenerating: true })
    try {
      const plan = await unwrap(
        window.api.ai.generateVisualPlan({ topicId: topic.id, content: currentContent() })
      )
      patchSession({ visualPlan: plan })
      toast.success('视觉方案已生成')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      patchSession({ visualGenerating: false })
    }
  }

  const updateVisualPlan = (plan: VisualPlan): void => {
    patchSession({ visualPlan: plan })
  }

  const copyPrompt = async (prompt: string): Promise<void> => {
    await window.api.exporter.copy(prompt)
    toast.success('Prompt 已复制')
  }

  const imageSrc = (asset: { localPath: string; dataUrl?: string }): string =>
    asset.dataUrl ?? `file://${asset.localPath}`

  const generateImage = async ({
    key,
    planId,
    kind,
    prompt
  }: {
    key: string
    planId: string
    kind: 'cover' | 'content'
    prompt: string
  }): Promise<void> => {
    patchSession({ generatingImageKey: key })
    try {
      const asset = await unwrap(window.api.ai.generateImage({ planId, kind, prompt }))
      patchSession({ imageAssets: { ...imageAssets, [key]: asset } })
      toast.success('图片已生成')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      patchSession({ generatingImageKey: null })
    }
  }

  const updateTopicStatus = async (item: Topic, status: Topic['status']): Promise<void> => {
    try {
      const updated = await unwrap(window.api.topic.setStatus(item.id, status))
      setTopics((prev) => prev.map((x) => (x.id === item.id ? updated : x)))
      if (composeSessions[item.id]) updateComposeSession(item.id, { topic: updated })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const cancelQueuedTopic = async (item: Topic): Promise<void> => {
    const queueState = getQueueState(item)
    await updateTopicStatus(item, 'candidate')
    if (queueState === 'generating' || queueState === 'unsaved') {
      toast.info('该话题还有未完成创作，会继续保留在创作队列中')
    }
  }

  const removeQueuedTopic = async (item: Topic): Promise<void> => {
    try {
      await unwrap(window.api.topic.remove(item.id))
      setTopics((prev) => prev.filter((x) => x.id !== item.id))
      clearComposeSession(item.id)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (!topicId) {
    return (
      <div>
        <PageHeader
          title="创作队列"
          description="管理已选用和未完成的创作任务"
          actions={
            personas.length > 0 && (
              <Select
                value={selectedPersonaId != null ? String(selectedPersonaId) : undefined}
                onValueChange={(v) => selectPersona(Number(v))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="选择人设" />
                </SelectTrigger>
                <SelectContent>
                  {personas.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }
        />
        <div className="space-y-4 px-8 py-6">
          {personas.length === 0 ? (
            <EmptyState
              icon={<Lightbulb className="h-8 w-8" />}
              title="先创建一个人设"
              description="创作队列需要绑定账号人设。请到「设置」新建。"
              action={
                <Button className="mt-1" onClick={() => navigate('/settings')}>
                  去设置
                </Button>
              }
            />
          ) : queueLoading ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : queueItems.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" />}
              title="还没有待创作题目"
              description={
                selectedPersona
                  ? `在「选题」中为「${selectedPersona.name}」点击「选用」或「去创作」，题目会进入这里。`
                  : '在「选题」中点击「选用」或「去创作」，题目会进入这里。'
              }
              action={
                <Button className="mt-1" onClick={() => navigate('/')}>
                  去选题
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {queueItems.map(({ topic: item, queueState }) => (
                <Card key={item.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          <Badge variant={queueState === 'selected' ? 'default' : 'secondary'}>
                            {QUEUE_LABEL[queueState]}
                          </Badge>
                          {item.score != null && <Badge variant="success">{item.score}分</Badge>}
                        </div>
                        {item.angle && (
                          <p className="text-sm text-muted-foreground">
                            <span className="text-foreground/70">角度：</span>
                            {item.angle}
                          </p>
                        )}
                        {item.hook && (
                          <p className="text-sm text-muted-foreground">
                            <span className="text-foreground/70">钩子：</span>
                            {item.hook}
                          </p>
                        )}
                        {item.rationale && (
                          <p className="text-sm text-muted-foreground">
                            <span className="text-foreground/70">why：</span>
                            {item.rationale}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <Button size="sm" onClick={() => navigate(`/compose/${item.id}`)}>
                          {queueState === 'generating' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PenLine className="h-4 w-4" />
                          )}
                          继续创作
                        </Button>
                        {item.status === 'selected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelQueuedTopic(item)}
                          >
                            取消选用
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => removeQueuedTopic(item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="创作工作台" />
        <div className="px-8 py-6 text-sm text-muted-foreground">加载中…</div>
      </div>
    )
  }

  if (!topic) {
    return (
      <div>
        <PageHeader title="创作工作台" />
        <div className="px-8 py-6">
          <EmptyState title="选题不存在或已被删除" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="创作工作台"
        description={persona ? `人设：${persona.name}` : undefined}
        actions={
          <>
            <Button variant="outline" onClick={generate} disabled={generating}>
              <Sparkles className="h-4 w-4" />
              {generating ? '生成中…' : hasContent ? '重新生成' : '生成内容'}
            </Button>
            {hasContent && (
              <Button onClick={save} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? '保存中…' : '保存草稿'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 px-8 py-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        {/* 左：选题信息 + 参考样本 */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2 pt-5">
              <div className="text-xs font-medium text-muted-foreground">当前选题</div>
              <div className="font-medium">{topic.title}</div>
              {topic.angle && <p className="text-sm text-muted-foreground">角度：{topic.angle}</p>}
              {topic.hook && <p className="text-sm text-muted-foreground">钩子：{topic.hook}</p>}
            </CardContent>
          </Card>

          {samples.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <button
                  className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => patchSession({ showSamples: !showSamples })}
                >
                  <Flame className="h-3.5 w-3.5" />
                  参考爆款{sampleIds.length > 0 ? `（已选 ${sampleIds.length}）` : ''}
                  <ChevronDown
                    className={`ml-auto h-3.5 w-3.5 transition-transform ${showSamples ? 'rotate-180' : ''}`}
                  />
                </button>
                {showSamples && (
                  <div className="mt-2 space-y-2">
                    {samples.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <Checkbox
                          checked={sampleIds.includes(s.id)}
                          onCheckedChange={() => toggleSample(s.id)}
                        />
                        <span className="truncate">{s.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右：生成结果编辑区 */}
        <div className="space-y-4">
          {!hasContent && !generating && (
            <EmptyState
              icon={<Sparkles className="h-8 w-8" />}
              title="点击「生成内容」开始创作"
              description="AI 会流式产出正文，并配套标题、标签、封面文案与配图建议。"
            />
          )}

          {(generating || hasContent) && (
            <>
              {titleOptions.length > 0 && (
                <Card>
                  <CardContent className="space-y-2 pt-5">
                    <Label>标题（点选作为主标题，可编辑）</Label>
                    <div className="space-y-1.5">
                      {titleOptions.map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={primaryIndex === i}
                            onChange={() => patchSession({ primaryIndex: i })}
                            className="accent-[var(--primary)]"
                          />
                          <Input
                            value={t}
                            onChange={(e) =>
                              patchSession({
                                titleOptions: titleOptions.map((o, idx) =>
                                  idx === i ? e.target.value : o
                                )
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="space-y-2 pt-5">
                  <div className="flex items-center justify-between">
                    <Label>
                      正文{generating && <span className="ml-2 text-xs text-primary">生成中…</span>}
                    </Label>
                    <div className="flex items-center gap-2">
                      {bodySelection.text && (
                        <Badge variant="secondary">已选中 {bodySelection.text.length} 字</Badge>
                      )}
                      <Button variant="ghost" size="sm" onClick={copyBody} disabled={!body}>
                        <Copy className="h-4 w-4" />
                        复制
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => patchSession({ body: e.target.value })}
                    onSelect={refreshSelection}
                    onKeyUp={refreshSelection}
                    onMouseUp={refreshSelection}
                    className="min-h-72 leading-relaxed"
                    placeholder="正文将在这里流式生成…"
                  />
                  {bodySelection.text && (
                    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_REWRITE_ACTIONS.map(({ key, label, icon: Icon, instruction }) => (
                          <Button
                            key={key}
                            size="sm"
                            variant="outline"
                            onClick={() => rewriteSelectedText(instruction)}
                            disabled={rewritingSelection || generating}
                          >
                            <Icon className="h-4 w-4" />
                            {label}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant={customSelectionOpen ? 'default' : 'outline'}
                          onClick={() =>
                            patchSession({ customSelectionOpen: !customSelectionOpen })
                          }
                          disabled={rewritingSelection || generating}
                        >
                          <Scissors className="h-4 w-4" />
                          自定义
                        </Button>
                      </div>
                      {customSelectionOpen && (
                        <div className="flex gap-2">
                          <Input
                            value={selectionInstruction}
                            onChange={(e) => patchSession({ selectionInstruction: e.target.value })}
                            placeholder="想怎么改这段？例如：更像闺蜜吐槽，但不要太夸张"
                          />
                          <Button
                            onClick={() => rewriteSelectedText(selectionInstruction)}
                            disabled={rewritingSelection || !selectionInstruction.trim()}
                          >
                            {rewritingSelection ? '改写中…' : '改写'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {hasContent && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardContent className="space-y-2 pt-5">
                        <Label>标签（空格分隔）</Label>
                        <Textarea
                          value={tagsText}
                          onChange={(e) => patchSession({ tagsText: e.target.value })}
                          className="min-h-20"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {splitTags(tagsText).map((t) => (
                            <Badge key={t} variant="secondary">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="space-y-3 pt-5">
                        <div className="space-y-1.5">
                          <Label>封面文案</Label>
                          <Input
                            value={coverCopy}
                            onChange={(e) => patchSession({ coverCopy: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>配图建议（每行一条）</Label>
                          <Textarea
                            value={imageIdeasText}
                            onChange={(e) => patchSession({ imageIdeasText: e.target.value })}
                            className="min-h-24"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardContent className="space-y-4 pt-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Image className="h-4 w-4" />
                            视觉方案
                          </div>
                          <div className="text-xs text-muted-foreground">
                            为封面和正文配图生成强相关画面方案与图像 Prompt
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={generateVisualPlan}
                          disabled={visualGenerating || generating || !body.trim()}
                        >
                          <Palette className="h-4 w-4" />
                          {visualGenerating ? '生成中…' : visualPlan ? '重新生成' : '生成视觉方案'}
                        </Button>
                      </div>

                      {!visualPlan ? (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                          当前稿件定稿后，可以生成封面图和正文配图的结构化方案。
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-md border p-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="font-medium">封面图</div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyPrompt(visualPlan.cover.prompt)}
                                >
                                  <Copy className="h-4 w-4" />
                                  复制 Prompt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    generateImage({
                                      key: 'cover',
                                      planId: 'cover',
                                      kind: 'cover',
                                      prompt: visualPlan.cover.prompt
                                    })
                                  }
                                  disabled={generatingImageKey === 'cover'}
                                >
                                  <Image className="h-4 w-4" />
                                  {generatingImageKey === 'cover' ? '生成中…' : '生成图片'}
                                </Button>
                              </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2 text-sm">
                                {imageAssets.cover && (
                                  <img
                                    src={imageSrc(imageAssets.cover)}
                                    className="aspect-[2/3] w-full rounded-md border object-cover"
                                  />
                                )}
                                <Input
                                  value={visualPlan.cover.title}
                                  onChange={(e) =>
                                    updateVisualPlan({
                                      ...visualPlan,
                                      cover: { ...visualPlan.cover, title: e.target.value }
                                    })
                                  }
                                />
                                <Input
                                  value={visualPlan.cover.subtitle}
                                  onChange={(e) =>
                                    updateVisualPlan({
                                      ...visualPlan,
                                      cover: { ...visualPlan.cover, subtitle: e.target.value }
                                    })
                                  }
                                />
                                <div className="text-xs text-muted-foreground">
                                  版式：{visualPlan.cover.layout}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  风格：{visualPlan.cover.style}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  色彩：{visualPlan.cover.colorPalette}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {visualPlan.cover.elements.map((el) => (
                                    <Badge key={el} variant="secondary">
                                      {el}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <Textarea
                                value={visualPlan.cover.prompt}
                                onChange={(e) =>
                                  updateVisualPlan({
                                    ...visualPlan,
                                    cover: { ...visualPlan.cover, prompt: e.target.value }
                                  })
                                }
                                className="min-h-44 text-xs leading-relaxed"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3">
                            {visualPlan.images.map((img, index) => (
                              <div key={img.id} className="rounded-md border p-3">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <div className="font-medium">
                                    配图 {index + 1} · {img.purpose}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyPrompt(img.prompt)}
                                    >
                                      <Copy className="h-4 w-4" />
                                      复制 Prompt
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        generateImage({
                                          key: img.id,
                                          planId: img.id,
                                          kind: 'content',
                                          prompt: img.prompt
                                        })
                                      }
                                      disabled={generatingImageKey === img.id}
                                    >
                                      <Image className="h-4 w-4" />
                                      {generatingImageKey === img.id ? '生成中…' : '生成图片'}
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    {imageAssets[img.id] && (
                                      <img
                                        src={imageSrc(imageAssets[img.id])}
                                        className="aspect-[2/3] w-full rounded-md border object-cover"
                                      />
                                    )}
                                    <Input
                                      value={img.textOverlay}
                                      onChange={(e) =>
                                        updateVisualPlan({
                                          ...visualPlan,
                                          images: visualPlan.images.map((item) =>
                                            item.id === img.id
                                              ? { ...item, textOverlay: e.target.value }
                                              : item
                                          )
                                        })
                                      }
                                    />
                                    <div className="text-xs leading-relaxed text-muted-foreground">
                                      画面：{img.scene}
                                    </div>
                                    <div className="text-xs leading-relaxed text-muted-foreground">
                                      构图：{img.composition}
                                    </div>
                                    <div className="text-xs leading-relaxed text-muted-foreground">
                                      风格：{img.style}
                                    </div>
                                  </div>
                                  <Textarea
                                    value={img.prompt}
                                    onChange={(e) =>
                                      updateVisualPlan({
                                        ...visualPlan,
                                        images: visualPlan.images.map((item) =>
                                          item.id === img.id
                                            ? { ...item, prompt: e.target.value }
                                            : item
                                        )
                                      })
                                    }
                                    className="min-h-36 text-xs leading-relaxed"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <History className="h-4 w-4" />
                    版本
                  </div>
                  <div className="text-xs text-muted-foreground">
                    保留生成和改写过程中的稿件快照
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveCurrentVersion}
                  disabled={!hasContent}
                >
                  <BookmarkPlus className="h-4 w-4" />
                  保存
                </Button>
              </div>
              {versions.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  生成内容后会自动保存初稿版本。
                </div>
              ) : (
                <div className="grid max-h-48 gap-2 overflow-y-auto pr-1">
                  {versions.map((version, index) => (
                    <button
                      key={version.id}
                      className={`rounded-md border p-2 text-left text-xs transition-colors ${
                        activeVersionId === version.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/60'
                      }`}
                      onClick={() => restoreVersion(version.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{version.label}</span>
                        <Badge variant={activeVersionId === version.id ? 'default' : 'muted'}>
                          v{versions.length - index}
                        </Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">AI 修改助手</div>
                  <div className="text-xs text-muted-foreground">诊断当前稿件并按要求重写</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={runReview}
                  disabled={reviewing || generating || !body.trim()}
                >
                  <Wand2 className="h-4 w-4" />
                  {reviewing ? '诊断中' : '诊断'}
                </Button>
              </div>

              {!review ? (
                <div className="rounded-md border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
                  生成或编辑正文后，点击诊断获取可勾选的修改建议；也可以直接输入自己的修改要求。
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md bg-muted/60 p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={review.overallScore >= 80 ? 'success' : 'secondary'}>
                        {review.overallScore}分
                      </Badge>
                      <span className="text-xs text-muted-foreground">综合诊断</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {review.summary}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {review.suggestions.map((suggestion) => (
                      <label
                        key={suggestion.id}
                        className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-xs"
                      >
                        <Checkbox
                          checked={selectedSuggestionIds.includes(suggestion.id)}
                          onCheckedChange={() => toggleSuggestion(suggestion.id)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{suggestion.title}</span>
                          <span className="mt-1 block leading-relaxed text-muted-foreground">
                            {suggestion.reason}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>自定义修改要求</Label>
                <Textarea
                  value={customInstruction}
                  onChange={(e) => patchSession({ customInstruction: e.target.value })}
                  className="min-h-24"
                  placeholder="例如：标题更犀利，正文更像闺蜜聊天，减少营销感，加一个真实案例…"
                />
              </div>

              <Button
                className="w-full"
                onClick={rewrite}
                disabled={
                  rewriting ||
                  generating ||
                  !body.trim() ||
                  (!selectedSuggestionIds.length && !customInstruction.trim())
                }
              >
                <RefreshCw className="h-4 w-4" />
                {rewriting ? '改写中…' : '按要求重写'}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
