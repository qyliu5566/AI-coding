import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, KeyRound, Check } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { unwrap } from '@/lib/ipc'
import { useAppStore } from '@/store/app'
import type { AppSettings, Persona, PersonaInput, ProviderId } from '@shared/types'

const EMPTY: PersonaInput = { name: '', niche: '', tone: '', audience: '', bio: '' }

// 各提供方的默认模型，切换时自动填入
const DEFAULT_MODELS: Record<ProviderId, string> = {
  claude: 'claude-opus-4-8',
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o'
}

function PersonaDialog({
  persona,
  trigger,
  onSaved
}: {
  persona?: Persona
  trigger: React.ReactNode
  onSaved: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PersonaInput>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        persona
          ? {
              name: persona.name,
              niche: persona.niche,
              tone: persona.tone,
              audience: persona.audience,
              bio: persona.bio
            }
          : EMPTY
      )
    }
  }, [open, persona])

  const set =
    (k: keyof PersonaInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (): Promise<void> => {
    if (!form.name.trim()) {
      toast.error('请填写人设名称')
      return
    }
    setSaving(true)
    try {
      if (persona) await unwrap(window.api.persona.update(persona.id, form))
      else await unwrap(window.api.persona.create(form))
      toast.success('已保存')
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{persona ? '编辑人设' : '新建人设'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>名称 *</Label>
            <Input value={form.name} onChange={set('name')} placeholder="如：理性护肤实验室" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>赛道</Label>
              <Input value={form.niche} onChange={set('niche')} placeholder="美妆 / 职场 / 美食…" />
            </div>
            <div className="grid gap-1.5">
              <Label>语气风格</Label>
              <Input value={form.tone} onChange={set('tone')} placeholder="亲切 / 专业 / 犀利…" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>目标人群</Label>
            <Input
              value={form.audience}
              onChange={set('audience')}
              placeholder="如：25-35 岁敏感肌女性"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>补充设定</Label>
            <Textarea
              value={form.bio}
              onChange={set('bio')}
              placeholder="账号定位、内容偏好、禁忌等"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
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

export default function SettingsPage(): React.JSX.Element {
  const personas = useAppStore((s) => s.personas)
  const loadPersonas = useAppStore((s) => s.loadPersonas)

  const [settings, setSettings] = useState<AppSettings>({
    provider: 'claude',
    model: 'claude-opus-4-8'
  })
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [savingModel, setSavingModel] = useState(false)

  const refreshKeyState = async (provider: ProviderId): Promise<void> => {
    setHasKey(await unwrap(window.api.settings.getApiKey(provider)))
  }

  // 切换提供方：填默认模型 + 刷新对应密钥状态(密钥按提供方分别存)
  const onProviderChange = (v: ProviderId): void => {
    setSettings((s) => ({ ...s, provider: v, model: DEFAULT_MODELS[v] }))
    setApiKey('')
    void refreshKeyState(v)
  }

  useEffect(() => {
    void (async () => {
      try {
        const s = await unwrap(window.api.settings.get())
        setSettings(s)
        await refreshKeyState(s.provider)
      } catch (e) {
        toast.error((e as Error).message)
      }
    })()
  }, [])

  const saveModel = async (): Promise<void> => {
    setSavingModel(true)
    try {
      const s = await unwrap(window.api.settings.set(settings))
      setSettings(s)
      await refreshKeyState(s.provider)
      toast.success('模型设置已保存')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingModel(false)
    }
  }

  const saveKey = async (): Promise<void> => {
    if (!apiKey.trim()) {
      toast.error('请填写 API Key')
      return
    }
    setSavingKey(true)
    try {
      const ok = await unwrap(window.api.settings.setApiKey(settings.provider, apiKey.trim()))
      setHasKey(ok)
      setApiKey('')
      toast.success('API Key 已加密保存')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingKey(false)
    }
  }

  const remove = async (p: Persona): Promise<void> => {
    if (!confirm(`确定删除人设「${p.name}」？`)) return
    try {
      await unwrap(window.api.persona.remove(p.id))
      toast.success('已删除')
      void loadPersonas()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader title="设置" description="配置 AI 模型与账号人设" />
      <div className="mx-auto max-w-3xl space-y-8 px-8 py-6">
        {/* AI 模型 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">AI 模型</h2>
          <Card>
            <CardContent className="grid gap-4 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>提供方</Label>
                  <Select
                    value={settings.provider}
                    onValueChange={(v) => onProviderChange(v as ProviderId)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude">Claude（推荐）</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>模型</Label>
                  <Input
                    value={settings.model}
                    onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                    placeholder="claude-opus-4-8"
                  />
                </div>
              </div>
              <div>
                <Button onClick={saveModel} disabled={savingModel} size="sm">
                  {savingModel ? '保存中…' : '保存模型设置'}
                </Button>
              </div>

              <div className="border-t pt-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Label>API Key</Label>
                  {hasKey ? (
                    <Badge variant="success">
                      <Check className="mr-1 h-3 w-3" />
                      已配置
                    </Badge>
                  ) : (
                    <Badge variant="muted">未配置</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      className="pl-8"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        hasKey
                          ? '已保存，输入可覆盖'
                          : settings.provider === 'deepseek'
                            ? 'sk-...（DeepSeek 开放平台密钥）'
                            : 'sk-ant-...'
                      }
                    />
                  </div>
                  <Button onClick={saveKey} disabled={savingKey} variant="outline">
                    {savingKey ? '保存中…' : '保存 Key'}
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  使用系统级加密(safeStorage)存储在本地，不会上传、不进入界面进程。
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 人设管理 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">账号人设</h2>
            <PersonaDialog
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  新建人设
                </Button>
              }
              onSaved={loadPersonas}
            />
          </div>

          {personas.length === 0 ? (
            <EmptyState
              title="还没有人设"
              description="人设决定了选题和文案的赛道、语气与目标人群，先建一个吧。"
            />
          ) : (
            <div className="grid gap-3">
              {personas.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-start justify-between gap-4 pt-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.niche && <Badge variant="secondary">{p.niche}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[p.tone && `语气：${p.tone}`, p.audience && `人群：${p.audience}`]
                          .filter(Boolean)
                          .join(' · ') || '暂无更多设定'}
                      </div>
                      {p.bio && <p className="text-xs text-muted-foreground">{p.bio}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <PersonaDialog
                        persona={p}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                        onSaved={loadPersonas}
                      />
                      <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
