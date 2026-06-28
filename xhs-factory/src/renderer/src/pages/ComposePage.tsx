import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Sparkles, Copy, Save, PenLine, ChevronDown, Flame } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { unwrap } from '@/lib/ipc'
import { useAppStore } from '@/store/app'
import type { Topic, ViralSample } from '@shared/types'

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

export default function ComposePage(): React.JSX.Element {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const personas = useAppStore((s) => s.personas)

  const [topic, setTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(false)
  const [samples, setSamples] = useState<ViralSample[]>([])
  const [sampleIds, setSampleIds] = useState<number[]>([])
  const [showSamples, setShowSamples] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [titleOptions, setTitleOptions] = useState<string[]>([])
  const [primaryIndex, setPrimaryIndex] = useState(0)
  const [body, setBody] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [coverCopy, setCoverCopy] = useState('')
  const [imageIdeasText, setImageIdeasText] = useState('')
  const [saving, setSaving] = useState(false)

  const persona = useMemo(
    () => personas.find((p) => p.id === topic?.personaId) ?? null,
    [personas, topic]
  )

  useEffect(() => {
    void (async () => {
      if (!topicId) {
        setTopic(null)
        return
      }
      setLoading(true)
      try {
        setTopic(await unwrap(window.api.topic.get(Number(topicId))))
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [topicId])

  useEffect(() => {
    void (async () => {
      try {
        setSamples(await unwrap(window.api.viral.list()))
      } catch {
        /* 忽略 */
      }
    })()
  }, [])

  const toggleSample = (id: number): void =>
    setSampleIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const generate = async (): Promise<void> => {
    if (!topic) return
    setGenerating(true)
    setHasContent(false)
    setBody('')
    setTitleOptions([])
    setTagsText('')
    setCoverCopy('')
    setImageIdeasText('')

    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
    const off = window.api.ai.onContentChunk((e) => {
      if (e.requestId === requestId) setBody((b) => b + e.delta)
    })
    try {
      const c = await unwrap(
        window.api.ai.generateContent({ requestId, topicId: topic.id, sampleIds })
      )
      setTitleOptions(c.titleOptions)
      setPrimaryIndex(0)
      setBody(c.body)
      setTagsText(c.tags.join(' '))
      setCoverCopy(c.coverCopy)
      setImageIdeasText(c.imageIdeas.join('\n'))
      setHasContent(true)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      off()
      setGenerating(false)
    }
  }

  const save = async (): Promise<void> => {
    if (!topic) return
    const titles = titleOptions.map((t) => t.trim()).filter(Boolean)
    const ordered =
      titles.length > 0
        ? [titles[primaryIndex] ?? titles[0], ...titles.filter((_, i) => i !== primaryIndex)]
        : []
    setSaving(true)
    try {
      const draft = await unwrap(
        window.api.draft.create({
          topicId: topic.id,
          personaId: topic.personaId,
          titleOptions: ordered,
          body: body.trim(),
          tags: splitTags(tagsText),
          coverCopy: coverCopy.trim(),
          imageIdeas: splitLines(imageIdeasText),
          status: 'draft'
        })
      )
      await window.api.topic.setStatus(topic.id, 'written')
      toast.success('已保存到草稿库')
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

  if (!topicId) {
    return (
      <div>
        <PageHeader title="创作工作台" description="从选题生成完整笔记" />
        <div className="px-8 py-6">
          <EmptyState
            icon={<PenLine className="h-8 w-8" />}
            title="请先从选题页选择一个选题"
            description="在「选题」中点击「去创作」即可进入创作。"
            action={
              <Button className="mt-1" onClick={() => navigate('/')}>
                去选题
              </Button>
            }
          />
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

      <div className="grid gap-5 px-8 py-6 lg:grid-cols-[320px_1fr]">
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
                  onClick={() => setShowSamples((s) => !s)}
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
                            onChange={() => setPrimaryIndex(i)}
                            className="accent-[var(--primary)]"
                          />
                          <Input
                            value={t}
                            onChange={(e) =>
                              setTitleOptions((opts) =>
                                opts.map((o, idx) => (idx === i ? e.target.value : o))
                              )
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
                    <Button variant="ghost" size="sm" onClick={copyBody} disabled={!body}>
                      <Copy className="h-4 w-4" />
                      复制
                    </Button>
                  </div>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="min-h-72 leading-relaxed"
                    placeholder="正文将在这里流式生成…"
                  />
                </CardContent>
              </Card>

              {hasContent && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardContent className="space-y-2 pt-5">
                      <Label>标签（空格分隔）</Label>
                      <Textarea
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
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
                        <Input value={coverCopy} onChange={(e) => setCoverCopy(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>配图建议（每行一条）</Label>
                        <Textarea
                          value={imageIdeasText}
                          onChange={(e) => setImageIdeasText(e.target.value)}
                          className="min-h-24"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
