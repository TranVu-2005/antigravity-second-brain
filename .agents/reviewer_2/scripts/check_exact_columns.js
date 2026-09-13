const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const agentDir = path.resolve(__dirname, '../');
const pristinePath = path.join(agentDir, 'pristine_brain.db');
const currentDbPath = path.resolve(__dirname, '../../../brain.db');

const currDb = new DatabaseSync(currentDbPath, { readOnly: true });
const pristDb = new DatabaseSync(pristinePath, { readOnly: true });

const tables = [
    'episodes',
    'user_profile',
    'solutions',
    'knowledge_items',
    'entities',
    'entity_relations',
    'conversations'
];

let nonAccessCountDiffs = 0;
for (const tbl of tables) {
    const currRows = currDb.prepare(`SELECT * FROM ${tbl}`).all();
    const pristRows = pristDb.prepare(`SELECT * FROM ${tbl}`).all();

    for (let i = 0; i < currRows.length; i++) {
        const c = currRows[i];
        const p = pristRows[i];

        for (const k of Object.keys(c)) {
            if (tbl === 'knowledge_items' && k === 'access_count') continue;

            if (Buffer.isBuffer(c[k]) && Buffer.isBuffer(p[k])) {
                if (!c[k].equals(p[k])) {
                    console.log(`Mismatch in ${tbl}[${i}].${k}`);
                    nonAccessCountDiffs++;
                }
            } else if (JSON.stringify(c[k]) !== JSON.stringify(p[k])) {
                console.log(`Mismatch in ${tbl}[${i}].${k}: ${c[k]} vs ${p[k]}`);
                nonAccessCountDiffs++;
            }
        }
    }
}

currDb.close();
pristDb.close();
console.log('Total non-access_count diffs across entire database:', nonAccessCountDiffs);
