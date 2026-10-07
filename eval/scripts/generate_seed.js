// ==============================================================================
// Antigravity Second Brain: Seed Database Fixture Generator
// Dumps current production brain.db tables into eval/datasets/seed_database.sql
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { getDB } = require('../../src/db');

const db = getDB();
const outDir = path.join(__dirname, '..', 'datasets');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'seed_database.sql');

let sql = `-- ==============================================================================
-- Antigravity Second Brain: Evaluation Suite Seed Database Fixtures
-- ==============================================================================
PRAGMA foreign_keys = ON;

`;

function sqlVal(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return v;
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
        return "X'" + Buffer.from(v).toString('hex') + "'";
    }
    return "'" + String(v).replace(/'/g, "''") + "'";
}

// 1. user_profile
const profiles = db.all('SELECT key, category, value, confidence, source, created_at, updated_at FROM user_profile');
sql += `-- 1. user_profile (${profiles.length} records)\n`;
for (const r of profiles) {
    sql += `INSERT OR REPLACE INTO user_profile (key, category, value, confidence, source, created_at, updated_at) VALUES (${sqlVal(r.key)}, ${sqlVal(r.category)}, ${sqlVal(r.value)}, ${sqlVal(r.confidence)}, ${sqlVal(r.source)}, ${sqlVal(r.created_at)}, ${sqlVal(r.updated_at)});\n`;
}
sql += '\n';

// 2. entities
const entities = db.all('SELECT id, name, type, description, created_at, updated_at FROM entities');
sql += `-- 2. entities (${entities.length} records)\n`;
for (const r of entities) {
    sql += `INSERT OR REPLACE INTO entities (id, name, type, description, created_at, updated_at) VALUES (${sqlVal(r.id)}, ${sqlVal(r.name)}, ${sqlVal(r.type)}, ${sqlVal(r.description)}, ${sqlVal(r.created_at)}, ${sqlVal(r.updated_at)});\n`;
}
sql += '\n';

// 3. entity_relations
const relations = db.all('SELECT id, source_entity, relation, target_entity, confidence, created_at, updated_at FROM entity_relations');
sql += `-- 3. entity_relations (${relations.length} records)\n`;
for (const r of relations) {
    sql += `INSERT OR REPLACE INTO entity_relations (id, source_entity, relation, target_entity, confidence, created_at, updated_at) VALUES (${sqlVal(r.id)}, ${sqlVal(r.source_entity)}, ${sqlVal(r.relation)}, ${sqlVal(r.target_entity)}, ${sqlVal(r.confidence)}, ${sqlVal(r.created_at)}, ${sqlVal(r.updated_at)});\n`;
}
sql += '\n';

// 4. knowledge_items
const knowledge = db.all('SELECT id, title, content, category, tags, source, importance, access_count, embedding, project_scope, created_at, updated_at FROM knowledge_items');
sql += `-- 4. knowledge_items (${knowledge.length} records)\n`;
for (const r of knowledge) {
    sql += `INSERT OR REPLACE INTO knowledge_items (id, title, content, category, tags, source, importance, access_count, embedding, project_scope, created_at, updated_at) VALUES (${sqlVal(r.id)}, ${sqlVal(r.title)}, ${sqlVal(r.content)}, ${sqlVal(r.category)}, ${sqlVal(r.tags)}, ${sqlVal(r.source)}, ${sqlVal(r.importance)}, ${sqlVal(r.access_count)}, ${sqlVal(r.embedding)}, ${sqlVal(r.project_scope)}, ${sqlVal(r.created_at)}, ${sqlVal(r.updated_at)});\n`;
}
sql += '\n';

// 5. solutions
const solutions = db.all('SELECT id, error_pattern, root_cause, solution_code, command_fix, project_scope, tags, confidence, success_count, created_at, updated_at FROM solutions');
sql += `-- 5. solutions (${solutions.length} records)\n`;
for (const r of solutions) {
    sql += `INSERT OR REPLACE INTO solutions (id, error_pattern, root_cause, solution_code, command_fix, project_scope, tags, confidence, success_count, created_at, updated_at) VALUES (${sqlVal(r.id)}, ${sqlVal(r.error_pattern)}, ${sqlVal(r.root_cause)}, ${sqlVal(r.solution_code)}, ${sqlVal(r.command_fix)}, ${sqlVal(r.project_scope)}, ${sqlVal(r.tags)}, ${sqlVal(r.confidence)}, ${sqlVal(r.success_count)}, ${sqlVal(r.created_at)}, ${sqlVal(r.updated_at)});\n`;
}
sql += '\n';

// 6. conversations
const convs = db.all('SELECT id, title, created_at, updated_at, summary, key_takeaways, message_count, last_step_index FROM conversations');
sql += `-- 6. conversations (${convs.length} records)\n`;
for (const r of convs) {
    sql += `INSERT OR REPLACE INTO conversations (id, title, created_at, updated_at, summary, key_takeaways, message_count, last_step_index) VALUES (${sqlVal(r.id)}, ${sqlVal(r.title)}, ${sqlVal(r.created_at)}, ${sqlVal(r.updated_at)}, ${sqlVal(r.summary)}, ${sqlVal(r.key_takeaways)}, ${sqlVal(r.message_count)}, ${sqlVal(r.last_step_index)});\n`;
}
sql += '\n';

// 7. episodes (all 1193 episodes)
const episodes = db.all('SELECT id, conversation_id, step_index, role, content, summary, tags, timestamp FROM episodes');
sql += `-- 7. episodes (${episodes.length} records)\n`;
for (const r of episodes) {
    sql += `INSERT OR REPLACE INTO episodes (id, conversation_id, step_index, role, content, summary, tags, timestamp) VALUES (${sqlVal(r.id)}, ${sqlVal(r.conversation_id)}, ${sqlVal(r.step_index)}, ${sqlVal(r.role)}, ${sqlVal(r.content)}, ${sqlVal(r.summary)}, ${sqlVal(r.tags)}, ${sqlVal(r.timestamp)});\n`;
}

fs.writeFileSync(outFile, sql, 'utf8');
console.log(`Generated ${outFile} (${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`);
