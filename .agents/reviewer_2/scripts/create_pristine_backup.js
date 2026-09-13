const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const backupPath = path.resolve('.agents/reviewer_2/pristine_brain.db');
if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

const db = new DatabaseSync('brain.db', { readOnly: true });
db.exec("VACUUM INTO '" + backupPath.replace(/\\/g, '/') + "'");
db.close();

const verifyDb = new DatabaseSync(backupPath, { readOnly: true });
const counts = {};
for (const t of ['episodes', 'user_profile', 'solutions', 'knowledge_items', 'entities', 'entity_relations', 'conversations']) {
  counts[t] = verifyDb.prepare('SELECT COUNT(*) as c FROM ' + t).get().c;
}
verifyDb.close();
console.log('Saved pristine backup with counts:', JSON.stringify(counts));
