import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Flame, Wand2 } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { unwrap } from '@/lib/ipc'
import type { ViralSample, ViralSampleInput } from '@shared/types'

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

function AddDialog({ onSaved }: { onSaved: () => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = (): void => {
    setTitle('')
    setBody('')
    setTagsText('')
    setNotes('')
  }

  const save = async (): Promise<void> => {
    if (!title.trim()) {
      toast.error('请填写标题')
      return
    }
    setSaving(true)
    try {
      const input: ViralSampleInput = {
        personaId: null,
        title: title.trim(),
        body: body.trim(),
        tags: splitTags(tagsText),
        notes: notes.trim()
      }
      await unwrap(window.api.viral.create(input))
      toast.success('已收录')
      reset()
      setOpen(false)
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          收录爆款
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>收录爆款样本</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            <Label>标题 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>正文</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-40 leading-relaxed"
              placeholder="粘贴爆款笔记正文，便于 AI 拆解结构"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>标签（空格分隔）</Label>
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>备注</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="为什么收录它"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? '保存中…' : '收录'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ViralPage(): React.JSX.Element {
  const [samples, setSamples] = useState<ViralSample[]>([])
  const [analyzing, setAnalyzing] = useState<number | null>(null)

  const load = async (): Promise<void> => {
    try {
      setSamples(await unwrap(window.api.viral.list()))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const analyze = async (s: ViralSample): Promise<void> => {
    setAnalyzing(s.id)
    try {
      const updated = await unwrap(window.api.viral.analyze(s.id))
      setSamples((prev) => prev.map((x) => (x.id === s.id ? updated : x)))
      toast.success('已拆解结构')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setAnalyzing(null)
    }
  }

  const remove = async (s: ViralSample): Promise<void> => {
    if (!confirm('确定删除该样本？')) return
    try {
      await unwrap(window.api.viral.remove(s.id))
      setSamples((prev) => prev.filter((x) => x.id !== s.id))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="爆款库"
        description="收录对标爆款，AI 拆解其套路，反哺选题与创作"
        actions={<AddDialog onSaved={load} />}
      />

      <div className="px-8 py-6">
        {samples.length === 0 ? (
          <EmptyState
            icon={<Flame className="h-8 w-8" />}
            title="还没有爆款样本"
            description="把你对标账号的爆文收录进来，作为选题/创作的参考。"
          />
        ) : (
          <div className="grid gap-3">
            {samples.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="font-medium">{s.title}</div>
                      {s.body && (
                        <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {s.body}
                        </p>
                      )}
                      {s.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {s.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {s.structure && (
                        <div className="mt-2 grid gap-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground/70">钩子：</span>
                            {s.structure.hook}
                          </div>
                          <div>
                            <span className="font-medium text-foreground/70">开头：</span>
                            {s.structure.opening}
                          </div>
                          <div>
                            <span className="font-medium text-foreground/70">结构：</span>
                            {s.structure.structure}
                          </div>
                          <div>
                            <span className="font-medium text-foreground/70">CTA：</span>
                            {s.structure.cta}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => analyze(s)}
                        disabled={analyzing === s.id}
                      >
                        <Wand2 className="h-4 w-4" />
                        {analyzing === s.id ? '拆解中…' : s.structure ? '重新拆解' : 'AI 拆解'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s)}>
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
