import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

// 简单的版本化迁移：每个数组元素是一个版本的 DDL 列表，按 user_version 增量执行。
// 加字段 = 追加一个新版本数组（含 ALTER / CREATE IF NOT EXISTS），不破坏旧数据。
const MIGRATIONS: string[][] = [
  // v1 — 初始表结构
  [
    `CREATE TABLE IF NOT EXISTS personas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      niche TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      angle TEXT NOT NULL DEFAULT '',
      hook TEXT NOT NULL DEFAULT '',
      rationale TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'candidate',
      score INTEGER,
      source TEXT NOT NULL DEFAULT 'ai',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER,
      persona_id INTEGER NOT NULL,
      title_options TEXT NOT NULL DEFAULT '[]',
      body TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      cover_copy TEXT NOT NULL DEFAULT '',
      image_ideas TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS viral_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id INTEGER,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      structure TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_topics_persona ON topics(persona_id)`,
    `CREATE INDEX IF NOT EXISTS idx_drafts_persona ON drafts(persona_id)`
  ],
  // v2 — 发布闭环 / 爆款公式 / 本地合规规则
  [
    `CREATE TABLE IF NOT EXISTS publish_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_id INTEGER NOT NULL,
      topic_id INTEGER,
      persona_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      planned_at INTEGER,
      published_at INTEGER,
      publish_url TEXT NOT NULL DEFAULT '',
      note_id TEXT NOT NULL DEFAULT '',
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      collects INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      follows INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS formula_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_id INTEGER,
      source_type TEXT NOT NULL DEFAULT 'viral',
      source_id INTEGER,
      name TEXT NOT NULL,
      hook_type TEXT NOT NULL DEFAULT '',
      opening TEXT NOT NULL DEFAULT '',
      structure TEXT NOT NULL DEFAULT '',
      cta TEXT NOT NULL DEFAULT '',
      applicable_niche TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE TABLE IF NOT EXISTS compliance_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '平台风险',
      severity TEXT NOT NULL DEFAULT 'medium',
      message TEXT NOT NULL DEFAULT '命中合规风险词',
      suggestion TEXT NOT NULL DEFAULT '建议替换为更客观、克制的表达',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_publish_persona ON publish_records(persona_id)`,
    `CREATE INDEX IF NOT EXISTS idx_publish_draft ON publish_records(draft_id)`,
    `CREATE INDEX IF NOT EXISTS idx_publish_status ON publish_records(status)`,
    `CREATE INDEX IF NOT EXISTS idx_formula_persona ON formula_patterns(persona_id)`,
    `CREATE INDEX IF NOT EXISTS idx_compliance_keyword ON compliance_rules(keyword)`,
    `INSERT INTO compliance_rules (keyword, category, severity, message, suggestion)
      SELECT '最有效', '过度承诺', 'high', '避免绝对化效果承诺', '改为“可能更适合”“对我有帮助”等经验表达'
      WHERE NOT EXISTS (SELECT 1 FROM compliance_rules WHERE keyword = '最有效')`,
    `INSERT INTO compliance_rules (keyword, category, severity, message, suggestion)
      SELECT '根治', '医疗健康', 'high', '医疗/功效类内容避免使用治疗承诺', '改为“缓解”“改善体验”，并补充个体差异'
      WHERE NOT EXISTS (SELECT 1 FROM compliance_rules WHERE keyword = '根治')`,
    `INSERT INTO compliance_rules (keyword, category, severity, message, suggestion)
      SELECT '永久', '过度承诺', 'medium', '避免永久性承诺', '改为“长期”“持续一段时间观察”'
      WHERE NOT EXISTS (SELECT 1 FROM compliance_rules WHERE keyword = '永久')`,
    `INSERT INTO compliance_rules (keyword, category, severity, message, suggestion)
      SELECT '100%', '过度承诺', 'high', '避免百分百承诺', '改为“大概率”“多数情况下”'
      WHERE NOT EXISTS (SELECT 1 FROM compliance_rules WHERE keyword = '100%')`,
    `INSERT INTO compliance_rules (keyword, category, severity, message, suggestion)
      SELECT '全网最低', '营销风险', 'medium', '价格类绝对化表述风险较高', '改为“我看到的低价”“近期好价”'
      WHERE NOT EXISTS (SELECT 1 FROM compliance_rules WHERE keyword = '全网最低')`
  ],
  // v3 — 草稿持久化视觉方案和已生成图片资产
  [
    `ALTER TABLE drafts ADD COLUMN visual_plan TEXT DEFAULT NULL`,
    `ALTER TABLE drafts ADD COLUMN image_assets TEXT NOT NULL DEFAULT '{}'`
  ]
]

export type DB = BetterSQLite3Database<typeof schema>

let _db: DB | null = null
let _sqlite: Database.Database | null = null

function runMigrations(sqlite: Database.Database): void {
  const current = sqlite.pragma('user_version', { simple: true }) as number
  for (let v = current; v < MIGRATIONS.length; v++) {
    const apply = sqlite.transaction(() => {
      for (const stmt of MIGRATIONS[v]) sqlite.exec(stmt)
      sqlite.pragma(`user_version = ${v + 1}`)
    })
    apply()
  }
}

export function initDb(): DB {
  if (_db) return _db
  const file = join(app.getPath('userData'), 'xhs-factory.db')
  _sqlite = new Database(file)
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('foreign_keys = ON')
  runMigrations(_sqlite)
  _db = drizzle(_sqlite, { schema })
  return _db
}

export function getDb(): DB {
  if (!_db) throw new Error('数据库未初始化')
  return _db
}

export function closeDb(): void {
  _sqlite?.close()
  _sqlite = null
  _db = null
}

export { schema }
