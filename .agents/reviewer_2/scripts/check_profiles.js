const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('brain.db', { readOnly: true });
console.log(db.prepare('SELECT category, key, value FROM user_profile ORDER BY key').all());
