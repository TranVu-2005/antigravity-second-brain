const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const agentDir = path.resolve(__dirname, '../');
const pristinePath = path.join(agentDir, 'pristine_brain.db');
const currentDbPath = path.resolve(__dirname, '../../../brain.db');

console.log('=== DATABASE INTEGRITY AND RECORD PRESERVATION CHECK ===');
const currDb = new DatabaseSync(currentDbPath, { readOnly: true });
const pristDb = new DatabaseSync(pristinePath, { readOnly: true });

// 1. PRAGMAs
const integrityCheck = currDb.prepare('PRAGMA integrity_check').all();
console.log('PRAGMA integrity_check:', JSON.stringify(integrityCheck));

const fkCheck = currDb.prepare('PRAGMA foreign_key_check').all();
console.log('PRAGMA foreign_key_check:', JSON.stringify(fkCheck));

// 2. Counts
const tables = [
    'episodes',
    'user_profile',
    'solutions',
    'knowledge_items',
    'entities',
    'entity_relations',
    'conversations'
];

const targetCounts = {
    episodes: 1193,
    user_profile: 12,
    solutions: 15,
    knowledge_items: 11,
    entities: 3,
    entity_relations: 2,
    conversations: 19
};

let allMatched = true;
for (const tbl of tables) {
    const currCount = currDb.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get().c;
    const pristCount = pristDb.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get().c;
    const target = targetCounts[tbl];

    const match = (currCount === target && currCount === pristCount);
    if (!match) allMatched = false;

    console.log(`Table [${tbl.padEnd(16)}]: Current = ${currCount} | Pristine = ${pristCount} | Expected = ${target} | Status: ${match ? 'MATCH' : 'MISMATCH'}`);
}

// 3. Row-by-row hash/data comparison
console.log('\n--- Row-by-Row Deep Comparison against Pristine Snapshot ---');
let diffFound = false;

for (const tbl of tables) {
    const currRows = currDb.prepare(`SELECT * FROM ${tbl}`).all();
    const pristRows = pristDb.prepare(`SELECT * FROM ${tbl}`).all();

    if (currRows.length !== pristRows.length) {
        console.error(`Row count mismatch in ${tbl}`);
        diffFound = true;
        continue;
    }

    for (let i = 0; i < currRows.length; i++) {
        const c = currRows[i];
        const p = pristRows[i];

        for (const k of Object.keys(c)) {
            if (Buffer.isBuffer(c[k]) && Buffer.isBuffer(p[k])) {
                if (!c[k].equals(p[k])) {
                    console.error(`Blob mismatch in ${tbl} row ${i} col ${k}`);
                    diffFound = true;
                }
            } else if (JSON.stringify(c[k]) !== JSON.stringify(p[k])) {
                console.error(`Data mismatch in ${tbl} row ${i} col ${k}: Current=${JSON.stringify(c[k])} vs Pristine=${JSON.stringify(p[k])}`);
                diffFound = true;
            }
        }
    }
}

currDb.close();
pristDb.close();

if (!diffFound && allMatched) {
    console.log('✅ ZERO DATA LOSS CONFIRMED: 100% of rows and columns are byte-for-byte identical to baseline!');
} else {
    console.error('❌ INTEGRITY CHECK FAILED: Differences detected.');
}
