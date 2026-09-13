const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('brain.db', { readOnly: true });
console.log(db.prepare('SELECT id, category, title FROM knowledge_items ORDER BY id').all());
