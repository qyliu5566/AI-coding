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
