import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Lightbulb, Sparkles, Trash2, PenLine, Check, ChevronDown, Flame } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import type { Topic, TopicStatus, ViralSample } from '@shared/types'

const STATUS_LABEL: Record<TopicStatus, string> = {
  candidate: '候选',
  selected: '已选',
  written: '已成稿',
  published: '已发布'
}

export default function TopicsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { personas, selectedPersonaId, selectPersona } = useAppStore()

  const [topics, setTopics] = useState<Topic[]>([])
  const [samples, setSamples] = useState<ViralSample[]>([])
  const [sampleIds, setSampleIds] = useState<number[]>([])
  const [keywords, setKeywords] = useState('')
  const [count, setCount] = useState(6)
  const [generating, setGenerating] = useState(false)
  const [showSamples, setShowSamples] = useState(false)

  const persona = useMemo(
    () => personas.find((p) => p.id === selectedPersonaId) ?? null,
    [personas, selectedPersonaId]
  )

  const loadTopics = async (personaId: number): Promise<void> => {
    try {
      setTopics(await unwrap(window.api.topic.list(personaId)))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  useEffect(() => {
    if (selectedPersonaId != null) void loadTopics(selectedPersonaId)
    else setTopics([])
  }, [selectedPersonaId])

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
    if (selectedPersonaId == null) {
      toast.error('请先选择人设')
      return
    }
    setGenerating(true)
    try {
      const created = await unwrap(
        window.api.topic.generate({ personaId: selectedPersonaId, keywords, count, sampleIds })
      )
      setTopics((prev) => [...created, ...prev])
      toast.success(`生成了 ${created.length} 个选题`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const setStatus = async (t: Topic, status: TopicStatus): Promise<void> => {
    try {
      const updated = await unwrap(window.api.topic.setStatus(t.id, status))
      setTopics((prev) => prev.map((x) => (x.id === t.id ? updated : x)))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const remove = async (t: Topic): Promise<void> => {
    try {
      await unwrap(window.api.topic.remove(t.id))
      setTopics((prev) => prev.filter((x) => x.id !== t.id))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const goCompose = async (t: Topic): Promise<void> => {
    if (t.status === 'candidate') await setStatus(t, 'selected')
    navigate(`/compose/${t.id}`)
  }

  return (
    <div>
      <PageHeader
        title="选题工作台"
        description="选择人设，让 AI 产出有爆款潜质的选题"
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

      <div className="space-y-5 px-8 py-6">
        {personas.length === 0 ? (
          <EmptyState
            icon={<Lightbulb className="h-8 w-8" />}
            title="先创建一个人设"
            description="选题需要绑定账号人设(赛道/语气/人群)。请到「设置」新建。"
            action={
              <Button className="mt-1" onClick={() => navigate('/settings')}>
                去设置
              </Button>
            }
          />
        ) : (
          <>
            {/* 生成控制区 */}
            <Card>
              <CardContent className="space-y-3 pt-5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-64 flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      关键词 / 方向（可选）
                    </label>
                    <Input
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="如：换季敏感肌、平价替代、新手入门…"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      数量
                    </label>
                    <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 6, 9, 12].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={generate} disabled={generating}>
                    <Sparkles className="h-4 w-4" />
                    {generating ? '生成中…' : '生成选题'}
                  </Button>
                </div>

                {samples.length > 0 && (
                  <div>
                    <button
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSamples((s) => !s)}
                    >
                      <Flame className="h-3.5 w-3.5" />
                      参考爆款样本{sampleIds.length > 0 ? `（已选 ${sampleIds.length}）` : ''}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${showSamples ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {showSamples && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {samples.map((s) => (
                          <label
                            key={s.id}
                            className="flex max-w-xs cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                          >
                            <Checkbox
                              checked={sampleIds.includes(s.id)}
                              onCheckedChange={() => toggleSample(s.id)}
                            />
                            <span className="truncate">{s.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 选题列表 */}
            {topics.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-8 w-8" />}
                title="还没有选题"
                description={persona ? `为「${persona.name}」生成第一批选题吧` : ''}
              />
            ) : (
              <div className="grid gap-3">
                {topics.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{t.title}</span>
                            <Badge variant={t.status === 'selected' ? 'default' : 'muted'}>
                              {STATUS_LABEL[t.status]}
                            </Badge>
                          </div>
                          {t.angle && (
                            <p className="text-sm text-muted-foreground">
                              <span className="text-foreground/70">角度：</span>
                              {t.angle}
                            </p>
                          )}
                          {t.hook && (
                            <p className="text-sm text-muted-foreground">
                              <span className="text-foreground/70">钩子：</span>
                              {t.hook}
                            </p>
                          )}
                          {t.rationale && (
                            <p className="text-sm text-muted-foreground">
                              <span className="text-foreground/70">why：</span>
                              {t.rationale}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <Button size="sm" onClick={() => goCompose(t)}>
                            <PenLine className="h-4 w-4" />
                            去创作
                          </Button>
                          {t.status === 'candidate' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(t, 'selected')}
                            >
                              <Check className="h-4 w-4" />
                              选用
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(t, 'candidate')}
                            >
                              取消选用
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
