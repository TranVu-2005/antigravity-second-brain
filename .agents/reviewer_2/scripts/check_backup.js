const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('backups/brain_backup_2026-09-12T19-00-02-169Z.db', { readOnly: true });
console.log('--- BACKUP COUNTS ---');
for (const t of ['episodes', 'user_profile', 'solutions', 'knowledge_items']) {
  console.log(t + ':', db.prepare('SELECT COUNT(*) as cnt FROM ' + t).get().cnt);
}
