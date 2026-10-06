// ==============================================================================
// Antigravity Second Brain: Database Driver & Connection Manager
// Built on Node 24 native node:sqlite with WAL Mode & Auto-Migration
// ==============================================================================

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const BRAIN_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(BRAIN_DIR, 'brain.db');
const SCHEMA_PATH = path.join(BRAIN_DIR, 'db', 'schema.sql');

class BrainDB {
    constructor(dbPath = DB_PATH) {
        this.dbPath = dbPath;
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        this.db = new DatabaseSync(this.dbPath);
        this._configurePragmas();
        this._initSchema();
    }

    _configurePragmas() {
        // Production-grade SQLite tuning for blazing fast concurrent reads and writes
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -64000;
            PRAGMA temp_store = MEMORY;
            PRAGMA mmap_size = 268435456;
            PRAGMA foreign_keys = ON;
        `);
    }

    _initSchema() {
        // Auto-migration for existing tables before applying new schema indexes
        try {
            const cols = this.db.prepare("PRAGMA table_info(knowledge_items)").all();
            if (cols.length > 0) {
                if (!cols.some(c => c.name === 'embedding')) {
                    this.db.exec("ALTER TABLE knowledge_items ADD COLUMN embedding BLOB;");
                }
                if (!cols.some(c => c.name === 'project_scope')) {
                    this.db.exec("ALTER TABLE knowledge_items ADD COLUMN project_scope TEXT DEFAULT 'global';");
                }
            }

            const relCols = this.db.prepare("PRAGMA table_info(entity_relations)").all();
            if (relCols.length > 0) {
                if (!relCols.some(c => c.name === 'valid_from')) {
                    this.db.exec("ALTER TABLE entity_relations ADD COLUMN valid_from TEXT DEFAULT NULL;");
                    this.db.exec("UPDATE entity_relations SET valid_from = datetime('now') WHERE valid_from IS NULL;");
                }
                if (!relCols.some(c => c.name === 'valid_until')) {
                    this.db.exec("ALTER TABLE entity_relations ADD COLUMN valid_until TEXT DEFAULT NULL;");
                }
                if (!relCols.some(c => c.name === 'metadata')) {
                    this.db.exec("ALTER TABLE entity_relations ADD COLUMN metadata TEXT DEFAULT '{}';");
                }

                // Check if table contains legacy table-level UNIQUE constraint
                const tbl = this.db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entity_relations'").get();
                if (tbl && tbl.sql && /UNIQUE\s*\(\s*source_entity\s*,\s*relation\s*,\s*target_entity\s*\)/i.test(tbl.sql)) {
                    this.db.exec(`
                        CREATE TABLE entity_relations_v37 (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            source_entity TEXT NOT NULL,
                            relation TEXT NOT NULL,
                            target_entity TEXT NOT NULL,
                            confidence REAL NOT NULL DEFAULT 1.0,
                            valid_from TEXT NOT NULL DEFAULT (datetime('now')),
                            valid_until TEXT DEFAULT NULL,
                            metadata TEXT DEFAULT '{}',
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                        );
                        INSERT INTO entity_relations_v37 (id, source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata, created_at, updated_at)
                        SELECT id, source_entity, relation, target_entity, confidence, valid_from, valid_until, metadata, created_at, updated_at FROM entity_relations;
                        DROP TABLE entity_relations;
                        ALTER TABLE entity_relations_v37 RENAME TO entity_relations;
                        CREATE INDEX IF NOT EXISTS idx_relations_source ON entity_relations(source_entity);
                        CREATE INDEX IF NOT EXISTS idx_relations_target ON entity_relations(target_entity);
                        CREATE INDEX IF NOT EXISTS idx_relations_validity ON entity_relations(source_entity, valid_until);
                        CREATE UNIQUE INDEX IF NOT EXISTS idx_relations_active ON entity_relations(source_entity, relation, target_entity) WHERE valid_until IS NULL;
                    `);
                }
            }
        } catch (e) {
            console.error('Migration error:', e.message);
        }

        if (fs.existsSync(SCHEMA_PATH)) {
            const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
            this.db.exec(schemaSql);
        }
    }

    _sanitizeParams(params) {
        if (!params || params.length === 0) return [];
        return params.map(p => (p === undefined ? null : p));
    }

    prepare(sql) {
        return this.db.prepare(sql);
    }

    exec(sql) {
        return this.db.exec(sql);
    }

    get(sql, ...params) {
        const stmt = this.db.prepare(sql);
        return stmt.get(...this._sanitizeParams(params));
    }

    all(sql, ...params) {
        const stmt = this.db.prepare(sql);
        return stmt.all(...this._sanitizeParams(params));
    }

    run(sql, ...params) {
        const stmt = this.db.prepare(sql);
        return stmt.run(...this._sanitizeParams(params));
    }

    transaction(fn) {
        this.db.exec('BEGIN TRANSACTION;');
        try {
            const result = fn(this);
            this.db.exec('COMMIT;');
            return result;
        } catch (err) {
            this.db.exec('ROLLBACK;');
            throw err;
        }
    }

    close() {
        this.db.close();
    }
}

let defaultInstance = null;

function getDB(dbPath = DB_PATH) {
    if (!defaultInstance || defaultInstance.dbPath !== dbPath) {
        defaultInstance = new BrainDB(dbPath);
    }
    return defaultInstance;
}

function createTestDB(customPath = ':memory:') {
    return new BrainDB(customPath);
}

module.exports = {
    BrainDB,
    getDB,
    createTestDB,
    BRAIN_DIR,
    DB_PATH
};
