-- ==============================================================================
-- Antigravity Second Brain: Production-Grade Schema
-- Designed for High-Performance Local AI Agent Cognitive Memory
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. Tier 0: Core Identity & User Profile
CREATE TABLE IF NOT EXISTS user_profile (
    key TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'general', -- 'identity', 'preference', 'tech_stack', 'environment', 'style'
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    source TEXT DEFAULT 'system',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Tier 1: Working Session State
CREATE TABLE IF NOT EXISTS session_state (
    conversation_id TEXT PRIMARY KEY,
    active_goal TEXT,
    current_topic TEXT,
    workspace_paths TEXT, -- JSON array
    metadata TEXT,        -- JSON object
    last_interaction TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Tier 2: Conversations & Episodic Log
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    summary TEXT,
    key_takeaways TEXT,   -- JSON array or bullet points
    message_count INTEGER NOT NULL DEFAULT 0,
    last_step_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT,          -- Comma-separated tags
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_episodes_conv ON episodes(conversation_id, step_index);
CREATE INDEX IF NOT EXISTS idx_episodes_time ON episodes(timestamp);

-- 4. Tier 3: Semantic Knowledge Store
CREATE TABLE IF NOT EXISTS knowledge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'fact', -- 'fact', 'concept', 'decision', 'rule', 'snippet', 'note'
    tags TEXT,                             -- Comma-separated tags
    source TEXT DEFAULT 'auto_extraction', -- 'user', 'agent', 'auto_extraction', 'sync'
    importance REAL NOT NULL DEFAULT 1.0,  -- 0.1 to 2.0
    access_count INTEGER NOT NULL DEFAULT 0,
    embedding BLOB,                        -- 384-dim dense float32 vector (1536 bytes)
    project_scope TEXT DEFAULT 'global',   -- 'global' or workspace directory name
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_importance ON knowledge_items(importance);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_items(project_scope);

-- 4.5. Tier 4: Procedural Memory (Bug, Error & Technical Solutions Store)
CREATE TABLE IF NOT EXISTS solutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_pattern TEXT NOT NULL,
    root_cause TEXT,
    solution_code TEXT NOT NULL,
    command_fix TEXT,
    project_scope TEXT DEFAULT 'global',
    tags TEXT,
    confidence REAL NOT NULL DEFAULT 1.0,
    success_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_solutions_project ON solutions(project_scope);

-- 5. Tier 3.5: Entity & Knowledge Graph Layer
CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    type TEXT NOT NULL DEFAULT 'concept', -- 'person', 'project', 'technology', 'location', 'tool'
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entity_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_entity TEXT NOT NULL,
    relation TEXT NOT NULL, -- 'uses', 'prefers', 'located_in', 'works_on', 'relates_to', 'supersedes', 'built_with'
    target_entity TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    valid_from TEXT NOT NULL DEFAULT (datetime('now')),
    valid_until TEXT DEFAULT NULL,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_entity, relation, target_entity, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON entity_relations(source_entity);
CREATE INDEX IF NOT EXISTS idx_relations_target ON entity_relations(target_entity);
CREATE INDEX IF NOT EXISTS idx_relations_validity ON entity_relations(source_entity, valid_until);

-- 6. Full-Text Search (FTS5) Virtual Tables
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
    title,
    content,
    tags,
    category,
    content='knowledge_items',
    content_rowid='id',
    tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
    summary,
    content,
    tags,
    content='episodes',
    content_rowid='id',
    tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS solutions_fts USING fts5(
    error_pattern,
    root_cause,
    solution_code,
    command_fix,
    tags,
    content='solutions',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- 7. Automatic Triggers for FTS Synchronization
CREATE TRIGGER IF NOT EXISTS trg_knowledge_ai AFTER INSERT ON knowledge_items BEGIN
    INSERT INTO knowledge_fts(rowid, title, content, tags, category)
    VALUES (new.id, new.title, new.content, new.tags, new.category);
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_ad AFTER DELETE ON knowledge_items BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, tags, category)
    VALUES ('delete', old.id, old.title, old.content, old.tags, old.category);
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_au AFTER UPDATE ON knowledge_items BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, tags, category)
    VALUES ('delete', old.id, old.title, old.content, old.tags, old.category);
    INSERT INTO knowledge_fts(rowid, title, content, tags, category)
    VALUES (new.id, new.title, new.content, new.tags, new.category);
END;

CREATE TRIGGER IF NOT EXISTS trg_episodes_ai AFTER INSERT ON episodes BEGIN
    INSERT INTO episodes_fts(rowid, summary, content, tags)
    VALUES (new.id, new.summary, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS trg_episodes_ad AFTER DELETE ON episodes BEGIN
    INSERT INTO episodes_fts(episodes_fts, rowid, summary, content, tags)
    VALUES ('delete', old.id, old.summary, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS trg_episodes_au AFTER UPDATE ON episodes BEGIN
    INSERT INTO episodes_fts(episodes_fts, rowid, summary, content, tags)
    VALUES ('delete', old.id, old.summary, old.content, old.tags);
    INSERT INTO episodes_fts(rowid, summary, content, tags)
    VALUES (new.id, new.summary, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS trg_solutions_ai AFTER INSERT ON solutions BEGIN
    INSERT INTO solutions_fts(rowid, error_pattern, root_cause, solution_code, command_fix, tags)
    VALUES (new.id, new.error_pattern, new.root_cause, new.solution_code, new.command_fix, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS trg_solutions_ad AFTER DELETE ON solutions BEGIN
    INSERT INTO solutions_fts(solutions_fts, rowid, error_pattern, root_cause, solution_code, command_fix, tags)
    VALUES ('delete', old.id, old.error_pattern, old.root_cause, old.solution_code, old.command_fix, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS trg_solutions_au AFTER UPDATE ON solutions BEGIN
    INSERT INTO solutions_fts(solutions_fts, rowid, error_pattern, root_cause, solution_code, command_fix, tags)
    VALUES ('delete', old.id, old.error_pattern, old.root_cause, old.solution_code, old.command_fix, old.tags);
    INSERT INTO solutions_fts(rowid, error_pattern, root_cause, solution_code, command_fix, tags)
    VALUES (new.id, new.error_pattern, new.root_cause, new.solution_code, new.command_fix, new.tags);
END;
