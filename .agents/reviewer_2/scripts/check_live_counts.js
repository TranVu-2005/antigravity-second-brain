const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('brain.db', { readOnly: true });
console.log('episodes:', db.prepare('SELECT COUNT(*) as c FROM episodes').get().c);
console.log('knowledge_items:', db.prepare('SELECT COUNT(*) as c FROM knowledge_items').get().c);
console.log('user_profile:', db.prepare('SELECT COUNT(*) as c FROM user_profile').get().c);
console.log('solutions:', db.prepare('SELECT COUNT(*) as c FROM solutions').get().c);
