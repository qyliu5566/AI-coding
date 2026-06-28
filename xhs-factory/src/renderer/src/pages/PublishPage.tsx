import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarDays, CheckCircle2, ExternalLink, Trash2 } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { unwrap } from '@/lib/ipc'
import { useAppStore } from '@/store/app'
import type { Draft, PublishMetricInput, PublishRecord, PublishStatus } from '@shared/types'

const STATUS_LABEL: Record<PublishStatus, string> = {
  planned: '待发布',
  published: '已发布',
  reviewed: '已复盘',
  archived: '已归档'
}

function toDateInput(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromDateInput(v: string): number | null {
  return v ? new Date(`${v}T09:00:00`).getTime() : null
}

function EditDialog({
  record,
  open,
  onOpenChange,
  onSaved
}: {
  record: PublishRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (record: PublishRecord) => void
}): React.JSX.Element {
  const [plannedAt, setPlannedAt] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [publishUrl, setPublishUrl] = useState('')
  const [noteId, setNoteId] = useState('')
  const [notes, setNotes] = useState('')
  const [metrics, setMetrics] = useState<PublishMetricInput>({
    views: 0,
    likes: 0,
    collects: 0,
    comments: 0,
    shares: 0,
    follows: 0
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!record || !open) return
    setPlannedAt(toDateInput(record.plannedAt))
    setPublishedAt(toDateInput(record.publishedAt))
    setPublishUrl(record.publishUrl)
    setNoteId(record.noteId)
    setNotes(record.notes)
    setMetrics({
      views: record.views,
      likes: record.likes,
      collects: record.collects,
      comments: record.comments,
      shares: record.shares,
      follows: record.follows
    })
  }, [record, open])

  const setMetric = (key: keyof PublishMetricInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setMetrics((m) => ({ ...m, [key]: Number(e.target.value || 0) }))

  const save = async (): Promise<void> => {
    if (!record) return
    setSaving(true)
    try {
      const updated = await unwrap(
        window.api.publish.update(record.id, {
          plannedAt: fromDateInput(plannedAt),
          publishedAt: fromDateInput(publishedAt),
          publishUrl: publishUrl.trim(),
          noteId: noteId.trim(),
          notes: notes.trim(),
          ...metrics,
          status: publishedAt ? 'published' : record.status
        })
      )
      toast.success('发布记录已更新')
      onSaved(updated)
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑发布记录</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>计划日期</Label>
              <Input type="date" value={plannedAt} onChange={(e) => setPlannedAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>发布日期</Label>
              <Input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>发布链接</Label>
              <Input value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>小红书笔记 ID</Label>
              <Input value={noteId} onChange={(e) => setNoteId(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['views', 'likes', 'collects', 'comments', 'shares', 'follows'] as const).map((k) => (
              <div key={k} className="grid gap-1.5">
                <Label>
                  {
                    {
                      views: '浏览',
                      likes: '点赞',
                      collects: '收藏',
                      comments: '评论',
                      shares: '分享',
                      follows: '涨粉'
                    }[k]
                  }
                </Label>
                <Input type="number" min={0} value={metrics[k]} onChange={setMetric(k)} />
              </div>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label>复盘备注</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
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

export default function PublishPage(): React.JSX.Element {
  const personas = useAppStore((s) => s.personas)
  const [records, setRecords] = useState<PublishRecord[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [status, setStatus] = useState<'all' | PublishStatus>('all')
  const [personaId, setPersonaId] = useState<'all' | string>('all')
  const [editing, setEditing] = useState<PublishRecord | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const filters = {
      ...(status !== 'all' ? { status } : {}),
      ...(personaId !== 'all' ? { personaId: Number(personaId) } : {})
    }
    setRecords(await unwrap(window.api.publish.list(filters)))
    setDrafts(await unwrap(window.api.draft.list()))
  }, [personaId, status])

  useEffect(() => {
    void load().catch((e) => toast.error((e as Error).message))
  }, [load])

  const draftMap = useMemo(() => new Map(drafts.map((d) => [d.id, d])), [drafts])
  const personaMap = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])

  const review = async (record: PublishRecord): Promise<void> => {
    try {
      const updated = await unwrap(window.api.publish.review(record.id))
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.success('已复盘，选题评分已更新')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const remove = async (record: PublishRecord): Promise<void> => {
    if (!confirm('确定删除该发布记录？草稿不会被删除。')) return
    try {
      await unwrap(window.api.publish.remove(record.id))
      setRecords((prev) => prev.filter((r) => r.id !== record.id))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="发布/日历"
        description="管理发布计划，手动回收表现数据"
        actions={
          <>
            <Select value={personaId} onValueChange={setPersonaId}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部人设</SelectItem>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as 'all' | PublishStatus)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <div className="px-8 py-6">
        {records.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="还没有发布计划"
            description="在草稿库中把已成稿内容加入发布计划。"
          />
        ) : (
          <div className="grid gap-3">
            {records.map((record) => {
              const draft = draftMap.get(record.draftId)
              const persona = personaMap.get(record.personaId)
              return (
                <Card key={record.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {draft?.titleOptions[0] ?? '(草稿已删除)'}
                          </span>
                          <Badge variant={record.status === 'reviewed' ? 'success' : 'muted'}>
                            {STATUS_LABEL[record.status]}
                          </Badge>
                          {persona && <Badge variant="secondary">{persona.name}</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          计划：{toDateInput(record.plannedAt) || '未设置'} · 发布：
                          {toDateInput(record.publishedAt) || '未发布'}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>浏览 {record.views}</span>
                          <span>点赞 {record.likes}</span>
                          <span>收藏 {record.collects}</span>
                          <span>评论 {record.comments}</span>
                          <span>分享 {record.shares}</span>
                          <span>涨粉 {record.follows}</span>
                        </div>
                        {record.publishUrl && (
                          <a
                            className="inline-flex items-center gap-1 text-xs text-primary"
                            href={record.publishUrl}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            查看发布链接
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditing(record)}>
                          编辑数据
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => review(record)}
                          disabled={record.status === 'reviewed'}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          复盘
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(record)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
      <EditDialog
        record={editing}
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(record) =>
          setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)))
        }
      />
    </div>
  )
}
