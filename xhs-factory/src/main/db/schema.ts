import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  TopicStatus,
  TopicSource,
  DraftStatus,
  VisualPlan,
  GeneratedImageAsset,
  ViralStructure,
  PublishStatus,
  ComplianceSeverity
} from '@shared/types'

const now = sql`(unixepoch() * 1000)`

export const personas = sqliteTable('personas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  niche: text('niche').notNull().default(''),
  tone: text('tone').notNull().default(''),
  audience: text('audience').notNull().default(''),
  bio: text('bio').notNull().default(''),
  createdAt: integer('created_at').notNull().default(now)
})

export const topics = sqliteTable('topics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personaId: integer('persona_id').notNull(),
  title: text('title').notNull(),
  angle: text('angle').notNull().default(''),
  hook: text('hook').notNull().default(''),
  rationale: text('rationale').notNull().default(''),
  status: text('status').$type<TopicStatus>().notNull().default('candidate'),
  score: integer('score'),
  source: text('source').$type<TopicSource>().notNull().default('ai'),
  createdAt: integer('created_at').notNull().default(now)
})

export const drafts = sqliteTable('drafts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  topicId: integer('topic_id'),
  personaId: integer('persona_id').notNull(),
  titleOptions: text('title_options', { mode: 'json' }).$type<string[]>().notNull().default([]),
  body: text('body').notNull().default(''),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  coverCopy: text('cover_copy').notNull().default(''),
  imageIdeas: text('image_ideas', { mode: 'json' }).$type<string[]>().notNull().default([]),
  visualPlan: text('visual_plan', { mode: 'json' }).$type<VisualPlan | null>(),
  imageAssets: text('image_assets', { mode: 'json' })
    .$type<Record<string, GeneratedImageAsset>>()
    .notNull()
    .default({}),
  status: text('status').$type<DraftStatus>().notNull().default('draft'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now)
})

export const viralSamples = sqliteTable('viral_samples', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personaId: integer('persona_id'),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  structure: text('structure', { mode: 'json' }).$type<ViralStructure | null>(),
  notes: text('notes').notNull().default(''),
  createdAt: integer('created_at').notNull().default(now)
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export const publishRecords = sqliteTable('publish_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  draftId: integer('draft_id').notNull(),
  topicId: integer('topic_id'),
  personaId: integer('persona_id').notNull(),
  status: text('status').$type<PublishStatus>().notNull().default('planned'),
  plannedAt: integer('planned_at'),
  publishedAt: integer('published_at'),
  publishUrl: text('publish_url').notNull().default(''),
  noteId: text('note_id').notNull().default(''),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  collects: integer('collects').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  follows: integer('follows').notNull().default(0),
  notes: text('notes').notNull().default(''),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now)
})

export const formulaPatterns = sqliteTable('formula_patterns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  personaId: integer('persona_id'),
  sourceType: text('source_type').$type<'viral' | 'draft'>().notNull().default('viral'),
  sourceId: integer('source_id'),
  name: text('name').notNull(),
  hookType: text('hook_type').notNull().default(''),
  opening: text('opening').notNull().default(''),
  structure: text('structure').notNull().default(''),
  cta: text('cta').notNull().default(''),
  applicableNiche: text('applicable_niche').notNull().default(''),
  audience: text('audience').notNull().default(''),
  notes: text('notes').notNull().default(''),
  createdAt: integer('created_at').notNull().default(now)
})

export const complianceRules = sqliteTable('compliance_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  keyword: text('keyword').notNull(),
  category: text('category').notNull().default('平台风险'),
  severity: text('severity').$type<ComplianceSeverity>().notNull().default('medium'),
  message: text('message').notNull().default('命中合规风险词'),
  suggestion: text('suggestion').notNull().default('建议替换为更客观、克制的表达'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().default(now)
})
