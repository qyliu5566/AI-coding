import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { TopicStatus, TopicSource, DraftStatus, ViralStructure } from '@shared/types'

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
