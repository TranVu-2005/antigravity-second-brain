// ==============================================================================
// Antigravity Second Brain: Centralized Configuration Layer
// Single Source of Truth for Paths, Runtime Directories, and Persistence
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// In Docker or production containers, BRAIN_DIR or BRAIN_HOME is set (e.g. /data/.antigravity_brain)
// On Host without env var, check if brain.db exists in repo directory; otherwise ~/.antigravity_brain
const repoRoot = path.resolve(__dirname, '..');
const defaultHome = fs.existsSync(path.join(repoRoot, 'brain.db')) 
    ? repoRoot 
    : path.join(os.homedir(), '.antigravity_brain');

const BRAIN_HOME = process.env.BRAIN_HOME || 
                   process.env.BRAIN_DIR || 
                   defaultHome;

const DB_PATH = process.env.DB_PATH || path.join(BRAIN_HOME, 'brain.db');
const EXPORTS_DIR = process.env.EXPORTS_DIR || path.join(BRAIN_HOME, 'exports');
const SCHEMA_PATH = path.resolve(__dirname, '..', 'db', 'schema.sql');

module.exports = {
    BRAIN_HOME,
    DB_PATH,
    EXPORTS_DIR,
    SCHEMA_PATH
};
