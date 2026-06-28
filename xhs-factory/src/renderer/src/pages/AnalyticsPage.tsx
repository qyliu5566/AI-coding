import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BarChart3, TrendingUp } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { unwrap } from '@/lib/ipc'
import type { AnalyticsOverview, PersonaAnalytics, TagAnalytics } from '@shared/types'

function Stat({
  label,
  value,
  suffix = ''
}: {
  label: string
  value: number
  suffix?: string
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">
          {value}
          {suffix}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage(): React.JSX.Element {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [personas, setPersonas] = useState<PersonaAnalytics[]>([])
  const [tags, setTags] = useState<TagAnalytics[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const [o, p, t] = await Promise.all([
          unwrap(window.api.analytics.overview()),
          unwrap(window.api.analytics.persona()),
          unwrap(window.api.analytics.topicTags())
        ])
        setOverview(o)
        setPersonas(p)
        setTags(t)
      } catch (e) {
        toast.error((e as Error).message)
      }
    })()
  }, [])

  return (
    <div>
      <PageHeader title="复盘" description="查看发布表现，识别高分选题和高价值标签" />
      <div className="space-y-5 px-8 py-6">
        {overview && (
          <div className="grid gap-3 md:grid-cols-5">
            <Stat label="已发布" value={overview.totalPublished} />
            <Stat label="已复盘" value={overview.reviewedCount} />
            <Stat label="平均互动率" value={overview.avgInteractionRate} suffix="%" />
            <Stat label="平均收藏率" value={overview.avgCollectRate} suffix="%" />
            <Stat label="高分选题" value={overview.highScoreTopics} />
          </div>
        )}

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            人设表现
          </h2>
          {personas.length === 0 ? (
            <EmptyState title="暂无人设数据" />
          ) : (
            <div className="grid gap-3">
              {personas.map((p) => (
                <Card key={p.personaId}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                    <div>
                      <div className="font-medium">{p.personaName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        发布 {p.totalPublished} · 复盘 {p.reviewedCount} · 高分 {p.highScoreTopics}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">互动 {p.avgInteractionRate}%</Badge>
                      <Badge variant="secondary">收藏 {p.avgCollectRate}%</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            标签表现
          </h2>
          {tags.length === 0 ? (
            <EmptyState title="暂无标签数据" description="复盘发布记录后，标签表现会自动汇总。" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 40).map((tag) => (
                <Badge key={tag.tag} variant={tag.avgScore >= 70 ? 'success' : 'secondary'}>
                  #{tag.tag} · {tag.avgScore}分 · {tag.count}次
                </Badge>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
