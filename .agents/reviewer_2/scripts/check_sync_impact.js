const path = require('path');
const { getDB } = require(path.join(process.cwd(), 'src/db'));
const { getEpisodicMemory } = require(path.join(process.cwd(), 'src/episodic'));
const fs = require('fs');

const brainDir = 'C:/Users/tvu16/.gemini/antigravity/brain';
const entries = fs.readdirSync(brainDir, { withFileTypes: true });
console.log('Total entries in brain dir:', entries.length);
const db = getDB();
const convIds = db.all('SELECT id, message_count, last_step_index FROM conversations');
console.log('Conversations in db:', convIds.length);
