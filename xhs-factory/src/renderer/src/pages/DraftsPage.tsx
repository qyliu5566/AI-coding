import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Copy,
  FileDown,
  Pencil,
  Trash2,
  FileText,
  CheckCircle2,
  CalendarPlus,
  ShieldCheck,
  Wand2,
  Image as ImageIcon,
  PenLine
} from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { unwrap } from '@/lib/ipc'
import { useAppStore } from '@/store/app'
import type { ComplianceIssue, Draft, DraftStatus, GeneratedImageAsset } from '@shared/types'

type ImageDataUrls = Record<string, string>

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
function fullText(d: Draft): string {
  const title = d.titleOptions[0] ?? ''
  const tags = d.tags.map((t) => `#${t}`).join(' ')
  return [title, '', d.body, '', tags].join('\n').trim()
}
function sortedAssets(draft: Draft): GeneratedImageAsset[] {
  return Object.values(draft.imageAssets ?? {}).sort((a, b) =>
    a.kind === b.kind ? a.createdAt - b.createdAt : a.kind === 'cover' ? -1 : 1
  )
}
function assetLabel(asset: GeneratedImageAsset, contentIndex: number): string {
  return asset.kind === 'cover' ? '封面图' : `正文配图 ${contentIndex}`
}

function ImageThumb({
  asset,
  className,
  dataUrl
}: {
  asset: GeneratedImageAsset
  className: string
  dataUrl?: string
}): React.JSX.Element {
  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-dashed bg-muted/40 p-2 text-center text-xs text-muted-foreground ${className}`}
      >
        图片文件不存在
      </div>
    )
  }
  return (
    <img src={dataUrl} className={className} alt={asset.kind === 'cover' ? '封面图' : '正文配图'} />
  )
}

function EditDialog({
  draft,
  open,
  onOpenChange,
  onSaved,
  imageDataUrls
}: {
  draft: Draft | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: (d: Draft) => void
  imageDataUrls: ImageDataUrls
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [coverCopy, setCoverCopy] = useState('')
  const [imageIdeasText, setImageIdeasText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (draft && open) {
      setTitle(draft.titleOptions[0] ?? '')
      setBody(draft.body)
      setTagsText(draft.tags.join(' '))
      setCoverCopy(draft.coverCopy)
      setImageIdeasText(draft.imageIdeas.join('\n'))
    }
  }, [draft, open])

  const save = async (): Promise<void> => {
    if (!draft) return
    setSaving(true)
    try {
      const rest = draft.titleOptions.slice(1)
      const updated = await unwrap(
        window.api.draft.update(draft.id, {
          titleOptions: [title.trim(), ...rest].filter(Boolean),
          body: body.trim(),
          tags: splitTags(tagsText),
          coverCopy: coverCopy.trim(),
          imageIdeas: splitLines(imageIdeasText)
        })
      )
      toast.success('已保存')
      onSaved(updated)
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const copyPrompt = async (prompt: string): Promise<void> => {
    await window.api.exporter.copy(prompt)
    toast.success('Prompt 已复制')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑草稿</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            <Label>主标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>正文</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-60 leading-relaxed"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>标签（空格分隔）</Label>
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>封面文案</Label>
            <Input value={coverCopy} onChange={(e) => setCoverCopy(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>配图建议（每行一条）</Label>
            <Textarea value={imageIdeasText} onChange={(e) => setImageIdeasText(e.target.value)} />
          </div>
          {draft && (draft.visualPlan || sortedAssets(draft).length > 0) && (
            <div className="grid gap-2 rounded-md border p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <ImageIcon className="h-4 w-4" />
                视觉资产
              </div>
              {draft.visualPlan && (
                <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  已保存视觉方案：封面图 1 个，正文配图 {draft.visualPlan.images.length} 个。
                </div>
              )}
              {sortedAssets(draft).length > 0 ? (
                <div className="grid gap-2">
                  {sortedAssets(draft).map((asset, index) => {
                    const contentIndex = sortedAssets(draft)
                      .slice(0, index + 1)
                      .filter((item) => item.kind === 'content').length
                    return (
                      <div key={asset.id} className="flex gap-3 rounded-md border p-2">
                        <ImageThumb
                          asset={asset}
                          dataUrl={imageDataUrls[asset.localPath]}
                          className="h-24 w-16 shrink-0 rounded-md border object-cover"
                        />
                        <div className="min-w-0 flex-1 space-y-1 text-xs">
                          <div className="font-medium">{assetLabel(asset, contentIndex)}</div>
                          <div className="truncate text-muted-foreground">{asset.localPath}</div>
                          <div className="line-clamp-2 text-muted-foreground">{asset.prompt}</div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyPrompt(asset.prompt)}
                          >
                            <Copy className="h-4 w-4" />
                            复制 Prompt
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  当前草稿保存了视觉方案，但还没有生成图片。
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DraftsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const ensureComposeSession = useAppStore((s) => s.ensureComposeSession)
  const updateComposeSession = useAppStore((s) => s.updateComposeSession)
  const selectPersona = useAppStore((s) => s.selectPersona)

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [imageDataUrls, setImageDataUrls] = useState<ImageDataUrls>({})
  const [filter, setFilter] = useState<'all' | DraftStatus>('all')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [issues, setIssues] = useState<ComplianceIssue[] | null>(null)
  const [checkingId, setCheckingId] = useState<number | null>(null)

  const load = async (): Promise<void> => {
    try {
      setDrafts(await unwrap(window.api.draft.list()))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const assets = drafts.flatMap((draft) => sortedAssets(draft))
    const missing = assets.filter((asset) => !(asset.localPath in imageDataUrls))
    if (!missing.length) return
    let cancelled = false
    void (async () => {
      const loaded: ImageDataUrls = {}
      await Promise.all(
        missing.map(async (asset) => {
          try {
            loaded[asset.localPath] = await unwrap(window.api.asset.imageDataUrl(asset.localPath))
          } catch {
            loaded[asset.localPath] = ''
          }
        })
      )
      if (!cancelled) {
        setImageDataUrls((prev) => ({ ...prev, ...loaded }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [drafts, imageDataUrls])

  const shown = drafts.filter((d) => filter === 'all' || d.status === filter)

  const copyFull = async (d: Draft): Promise<void> => {
    await window.api.exporter.copy(fullText(d))
    toast.success('已复制（标题+正文+标签）')
  }

  const exportMd = async (d: Draft): Promise<void> => {
    try {
      const res = await unwrap(window.api.exporter.markdown(d.id))
      if (res.saved) toast.success(`已导出资料包：${res.folderPath ?? ''}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const continueCompose = async (d: Draft): Promise<void> => {
    if (d.topicId == null) {
      toast.error('该草稿没有关联选题，暂时无法回到创作工作台')
      return
    }
    try {
      const topic = await unwrap(window.api.topic.get(d.topicId))
      if (!topic) {
        toast.error('关联选题不存在，无法继续创作')
        return
      }
      ensureComposeSession(topic)
      updateComposeSession(topic.id, {
        draftId: d.id,
        hasContent: true,
        titleOptions: d.titleOptions,
        primaryIndex: 0,
        body: d.body,
        tagsText: d.tags.join(' '),
        coverCopy: d.coverCopy,
        imageIdeasText: d.imageIdeas.join('\n'),
        visualPlan: d.visualPlan,
        imageAssets: d.imageAssets,
        review: null,
        selectedSuggestionIds: [],
        customInstruction: '',
        selectionInstruction: '',
        customSelectionOpen: false,
        bodySelection: { start: 0, end: 0, text: '' },
        error: null
      })
      selectPersona(d.personaId)
      navigate(`/compose/${topic.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const toggleStatus = async (d: Draft): Promise<void> => {
    try {
      const updated = await unwrap(
        window.api.draft.update(d.id, { status: d.status === 'final' ? 'draft' : 'final' })
      )
      setDrafts((prev) => prev.map((x) => (x.id === d.id ? updated : x)))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const addToPlan = async (d: Draft): Promise<void> => {
    try {
      await unwrap(
        window.api.publish.create({
          draftId: d.id,
          topicId: d.topicId,
          personaId: d.personaId,
          status: 'planned'
        })
      )
      toast.success('已加入发布计划')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const checkCompliance = async (d: Draft): Promise<void> => {
    setCheckingId(d.id)
    try {
      const result = await unwrap(
        window.api.compliance.check({
          title: d.titleOptions[0] ?? '',
          body: d.body,
          tags: d.tags
        })
      )
      setIssues(result)
      toast[result.length ? 'warning' : 'success'](
        result.length ? `发现 ${result.length} 个合规提示` : '未发现明显合规风险'
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCheckingId(null)
    }
  }

  const createFormula = async (d: Draft): Promise<void> => {
    try {
      await unwrap(window.api.formula.createFromDraft(d.id))
      toast.success('已沉淀为爆款公式')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const remove = async (d: Draft): Promise<void> => {
    if (!confirm('确定删除该草稿？')) return
    try {
      await unwrap(window.api.draft.remove(d.id))
      setDrafts((prev) => prev.filter((x) => x.id !== d.id))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="草稿库"
        description="管理已生成的笔记，复制或导出后去小红书发布"
        actions={
          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | DraftStatus)}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="draft">草稿</TabsTrigger>
              <TabsTrigger value="final">已成稿</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="px-8 py-6">
        {shown.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="还没有草稿"
            description="在「创作」里生成内容并保存，就会出现在这里。"
          />
        ) : (
          <div className="grid gap-3">
            {shown.map((d) => (
              <Card key={d.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    {sortedAssets(d).find((asset) => asset.kind === 'cover') && (
                      <ImageThumb
                        asset={sortedAssets(d).find((asset) => asset.kind === 'cover')!}
                        dataUrl={
                          imageDataUrls[
                            sortedAssets(d).find((asset) => asset.kind === 'cover')!.localPath
                          ]
                        }
                        className="h-32 w-24 shrink-0 rounded-md border object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{d.titleOptions[0] ?? '(未命名)'}</span>
                        <Badge variant={d.status === 'final' ? 'success' : 'muted'}>
                          {d.status === 'final' ? '已成稿' : '草稿'}
                        </Badge>
                        {d.visualPlan && <Badge variant="secondary">视觉方案</Badge>}
                        {sortedAssets(d).length > 0 && (
                          <Badge variant="secondary">{sortedAssets(d).length} 张图</Badge>
                        )}
                      </div>
                      <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {d.body}
                      </p>
                      {d.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {d.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {sortedAssets(d).filter((asset) => asset.kind === 'content').length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {sortedAssets(d)
                            .filter((asset) => asset.kind === 'content')
                            .map((asset) => (
                              <ImageThumb
                                key={asset.id}
                                asset={asset}
                                dataUrl={imageDataUrls[asset.localPath]}
                                className="h-20 w-14 rounded-md border object-cover"
                              />
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => copyFull(d)}>
                        <Copy className="h-4 w-4" />
                        复制
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => exportMd(d)}>
                        <FileDown className="h-4 w-4" />
                        导出资料包
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => continueCompose(d)}>
                        <PenLine className="h-4 w-4" />
                        继续创作
                      </Button>
                      {d.status === 'final' && (
                        <Button size="sm" variant="outline" onClick={() => addToPlan(d)}>
                          <CalendarPlus className="h-4 w-4" />
                          加入计划
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => checkCompliance(d)}
                        disabled={checkingId === d.id}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {checkingId === d.id ? '检查中' : '合规'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => createFormula(d)}>
                        <Wand2 className="h-4 w-4" />
                        沉淀公式
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(d)
                          setEditOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(d)}>
                        <CheckCircle2 className="h-4 w-4" />
                        {d.status === 'final' ? '转草稿' : '成稿'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(d)}>
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

      <EditDialog
        draft={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={(d) => setDrafts((prev) => prev.map((x) => (x.id === d.id ? d : x)))}
        imageDataUrls={imageDataUrls}
      />
      <Dialog open={issues != null} onOpenChange={(open) => !open && setIssues(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>合规检查</DialogTitle>
          </DialogHeader>
          {!issues?.length ? (
            <div className="py-6 text-sm text-muted-foreground">未发现明显合规风险。</div>
          ) : (
            <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
              {issues.map((issue, i) => (
                <div key={`${issue.matchedText}-${i}`} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={issue.severity === 'high' ? 'default' : 'secondary'}>
                      {issue.severity}
                    </Badge>
                    <span className="font-medium">{issue.category}</span>
                    <span className="text-muted-foreground">命中：{issue.matchedText}</span>
                  </div>
                  <div className="mt-2 text-muted-foreground">{issue.message}</div>
                  <div className="mt-1 text-muted-foreground">建议：{issue.suggestion}</div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIssues(null)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
