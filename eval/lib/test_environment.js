// ==============================================================================
// Antigravity Second Brain: Isolated Test Environment Sandbox
// Provides 100% DB Isolation & Reproducible Fixture Seeding
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { BrainDB } = require('../../src/db');
const dbModule = require('../../src/db');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const EVAL_DIR = path.resolve(__dirname, '..');
const TEST_DB_PATH = path.join(EVAL_DIR, 'eval_temp_brain.db');
const SEED_SQL_PATH = path.join(EVAL_DIR, 'datasets', 'seed_database.sql');
const SCHEMA_SQL_PATH = path.join(PROJECT_ROOT, 'db', 'schema.sql');

class TestEnvironment {
    constructor(options = {}) {
        this.testDbPath = options.dbPath || TEST_DB_PATH;
        this.seedSqlPath = options.seedSqlPath || SEED_SQL_PATH;
        this.schemaSqlPath = options.schemaSqlPath || SCHEMA_SQL_PATH;
        this.db = null;
        this.isSetup = false;

        this._origGetDB = dbModule.getDB;
        this._profileModule = null;
        this._origSyncFiles = null;
    }

    /**
     * Cleans up any existing temporary database files.
     */
    _cleanDbFiles() {
        const paths = [
            this.testDbPath,
            `${this.testDbPath}-wal`,
            `${this.testDbPath}-shm`
        ];
        for (const p of paths) {
            try {
                if (fs.existsSync(p)) {
                    fs.unlinkSync(p);
                }
            } catch (e) {
                // Ignore transient file lock cleanup errors
            }
        }
    }

    /**
     * Initializes the isolated sandbox:
     * 1. Purges previous temp database
     * 2. Initializes SQLite schema & seeds fixtures
     * 3. Patches getDB() to guarantee zero-pollution of production brain.db
     * 4. Stubs profile file sync to protect profile.md/profile.json
     */
    setup() {
        this._cleanDbFiles();

        // 1. Initialize fresh BrainDB instance at test path
        this.db = new BrainDB(this.testDbPath);

        // 2. Execute seed dataset
        if (fs.existsSync(this.seedSqlPath)) {
            const seedSql = fs.readFileSync(this.seedSqlPath, 'utf8');
            this.db.exec(seedSql);
        }

        // 3. Patch dbModule.getDB so any caller defaulting to getDB() gets test DB
        const self = this;
        dbModule.getDB = function (targetPath = dbModule.DB_PATH) {
            if (self.db && (targetPath === dbModule.DB_PATH || targetPath === self.testDbPath)) {
                return self.db;
            }
            return self._origGetDB(targetPath);
        };

        // 4. Protect production profile.md and profile.json from test mutations
        try {
            this._profileModule = require('../../src/profile');
            if (this._profileModule && this._profileModule.ProfileManager) {
                this._origSyncFiles = this._profileModule.ProfileManager.prototype.syncFiles;
                this._profileModule.ProfileManager.prototype.syncFiles = function () {
                    // No-op during eval suite runs to protect production profile docs
                };
            }
        } catch (e) {}

        this.isSetup = true;
        return this;
    }

    /**
     * Resets the database to clean seed state without unhooking monkey patches.
     */
    reset() {
        if (!this.db) return this.setup();

        try {
            // Truncate tables and re-seed
            this.db.exec(`
                PRAGMA foreign_keys = OFF;
                DELETE FROM user_profile;
                DELETE FROM knowledge_items;
                DELETE FROM solutions;
                DELETE FROM episodes;
                DELETE FROM conversations;
                DELETE FROM entities;
                DELETE FROM entity_relations;
                PRAGMA foreign_keys = ON;
            `);

            if (fs.existsSync(this.seedSqlPath)) {
                const seedSql = fs.readFileSync(this.seedSqlPath, 'utf8');
                this.db.exec(seedSql);
            }
        } catch (e) {
            // Fallback: full setup
            this.teardown();
            this.setup();
        }
    }

    /**
     * Closes database connection and removes temp database files.
     */
    teardown() {
        // Restore dbModule.getDB
        if (this._origGetDB) {
            dbModule.getDB = this._origGetDB;
        }

        // Restore ProfileManager.syncFiles
        if (this._profileModule && this._origSyncFiles) {
            this._profileModule.ProfileManager.prototype.syncFiles = this._origSyncFiles;
        }

        if (this.db) {
            try {
                this.db.close();
            } catch (e) {}
            this.db = null;
        }

        this._cleanDbFiles();
        this.isSetup = false;
    }

    // Instantiation helpers connected directly to isolated DB
    getSemanticKnowledge() {
        const { SemanticKnowledge } = require('../../src/semantic');
        return new SemanticKnowledge(this.db);
    }

    getSolutionStore() {
        const { SolutionStore } = require('../../src/solutions');
        return new SolutionStore(this.db);
    }

    getProfileManager() {
        const { ProfileManager } = require('../../src/profile');
        return new ProfileManager(this.db);
    }

    getEpisodicMemory() {
        const { EpisodicMemory } = require('../../src/episodic');
        return new EpisodicMemory(this.db);
    }

    getMemoryExtractor() {
        const { MemoryExtractor } = require('../../src/extractor');
        const pm = this.getProfileManager();
        const sem = this.getSemanticKnowledge();
        const sol = this.getSolutionStore();
        return new MemoryExtractor(pm, sem, sol);
    }

    getContextRetriever() {
        const { ContextRetriever } = require('../../src/retriever');
        const retriever = new ContextRetriever();
        retriever.profile = this.getProfileManager();
        retriever.semantic = this.getSemanticKnowledge();
        retriever.episodic = this.getEpisodicMemory();
        retriever.solutions = this.getSolutionStore();
        return retriever;
    }
}

let activeEnv = null;

function getTestEnvironment(options = {}) {
    if (!activeEnv) {
        activeEnv = new TestEnvironment(options);
    }
    return activeEnv;
}

module.exports = {
    TestEnvironment,
    getTestEnvironment,
    TEST_DB_PATH,
    SEED_SQL_PATH
};
