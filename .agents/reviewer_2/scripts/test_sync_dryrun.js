const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const projectRoot = path.resolve(__dirname, '../../../');
const { BrainDB } = require(path.join(projectRoot, 'src/db'));
const { EpisodicMemory } = require(path.join(projectRoot, 'src/episodic'));

const tempDbPath = path.join(projectRoot, '.agents/reviewer_2/temp_dryrun_brain.db');
if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

const sourceDb = new DatabaseSync(path.join(projectRoot, 'brain.db'), { readOnly: true });
const targetDb = new BrainDB(tempDbPath);

const tables = ['conversations', 'episodes', 'user_profile', 'knowledge_items', 'solutions', 'entities', 'entity_relations'];
for (const t of tables) {
  const rows = sourceDb.prepare('SELECT * FROM ' + t).all();
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    const placeholders = keys.map(() => '?').join(',');
    const stmt = targetDb.db.prepare('INSERT INTO ' + t + ' (' + keys.join(',') + ') VALUES (' + placeholders + ')');
    for (const r of rows) {
      stmt.run(...keys.map(k => r[k]));
    }
  }
}
console.log('Cloned brain.db to temp_dryrun_brain.db');
const beforeEp = targetDb.get('SELECT COUNT(*) as cnt FROM episodes').cnt;
const beforeConv = targetDb.get('SELECT COUNT(*) as cnt FROM conversations').cnt;
console.log('Before sync: ' + beforeConv + ' convs, ' + beforeEp + ' episodes');

const episodic = new EpisodicMemory(targetDb);
const res = episodic.syncAllConversations();
console.log('Sync result: synced ' + res.syncedConversations + ' convs, added ' + res.totalNewEpisodes + ' new episodes');

const afterEp = targetDb.get('SELECT COUNT(*) as cnt FROM episodes').cnt;
const afterConv = targetDb.get('SELECT COUNT(*) as cnt FROM conversations').cnt;
console.log('After sync: ' + afterConv + ' convs, ' + afterEp + ' episodes');

targetDb.close();
sourceDb.close();
for (const f of [tempDbPath, tempDbPath + '-shm', tempDbPath + '-wal']) {
  if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (e) {}
}
