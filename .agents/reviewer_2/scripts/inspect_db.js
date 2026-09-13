const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('brain.db', { readOnly: true });
console.log('--- INTEGRITY CHECK ---');
console.log(JSON.stringify(db.prepare('PRAGMA integrity_check').all()));
console.log('--- COUNTS ---');
for (const t of ['episodes', 'user_profile', 'solutions', 'knowledge_items', 'entities', 'entity_relations', 'conversations']) {
  console.log(t + ':', db.prepare('SELECT COUNT(*) as cnt FROM ' + t).get().cnt);
}
