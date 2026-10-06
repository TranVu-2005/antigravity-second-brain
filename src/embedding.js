// ==============================================================================
// Antigravity Second Brain: Multilingual Neural Dense Vector Engine
// Powered by 384-dimensional Multilingual Transformer with Auto-Daemon & Fallback
// ==============================================================================

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, exec, execSync } = require('node:child_process');

const VECTOR_DIM = 384;
const DAEMON_PORT = 49152;
const DAEMON_HOST = '127.0.0.1';
const DAEMON_URL = `http://${DAEMON_HOST}:${DAEMON_PORT}`;
const DAEMON_SCRIPT = path.join(__dirname, 'embedding_daemon.py');

/**
 * Dynamically resolves uv executable path across Windows and Linux
 */
function resolveUvCommand() {
    try {
        execSync('uv --version', { stdio: 'ignore' });
        return 'uv';
    } catch (e) {}

    const candidates = process.platform === 'win32' ? [
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe', 'uv.exe'),
        path.join(process.env.USERPROFILE || '', '.cargo', 'bin', 'uv.exe'),
        'C:\\Program Files\\uv\\uv.exe'
    ] : [
        path.join(os.homedir(), '.cargo', 'bin', 'uv'),
        path.join(os.homedir(), '.local', 'bin', 'uv'),
        '/usr/local/bin/uv',
        '/usr/bin/uv'
    ];

    for (const c of candidates) {
        if (c && fs.existsSync(c)) {
            return process.platform === 'win32' ? `"${c}"` : c;
        }
    }

    return 'uv';
}

const UV_PATH = resolveUvCommand();

// High-speed In-Memory LRU-style Embedding Cache
const _embeddingCache = new Map();
const MAX_CACHE_SIZE = 1000;

let _daemonSpawnAttempted = false;

/**
 * Normalizes a Float32Array vector in-place to unit L2 norm.
 */
function normalizeL2(vec) {
    let sumSq = 0;
    for (let i = 0; i < vec.length; i++) {
        sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
        for (let i = 0; i < vec.length; i++) {
            vec[i] /= norm;
        }
    }
    return vec;
}

/**
 * Checks if the Local Embedding Daemon is alive and responsive.
 */
async function isDaemonHealthy() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 400);
        const res = await fetch(`${DAEMON_URL}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            return data.status === 'ready' && data.dimension === VECTOR_DIM;
        }
    } catch (e) {
        // Daemon not reachable
    }
    return false;
}

/**
 * Automatically launches the embedding daemon in the background if not active.
 * Uses WMI on Windows or POSIX nohup/spawn on Linux.
 */
function ensureDaemonRunning() {
    if (process.env.NODE_ENV === 'test') return;
    if (_daemonSpawnAttempted) return;
    _daemonSpawnAttempted = true;

    isDaemonHealthy().then((healthy) => {
        if (!healthy) {
            try {
                if (process.platform === 'win32') {
                    const startScript = path.resolve(__dirname, '../scripts/start_daemon.ps1');
                    if (fs.existsSync(startScript)) {
                        const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', startScript], {
                            detached: true,
                            stdio: 'ignore',
                            windowsHide: true
                        });
                        p.unref();
                    }
                } else {
                    // Linux / macOS environment
                    const startScript = path.resolve(__dirname, '../scripts/start_daemon.sh');
                    if (fs.existsSync(startScript)) {
                        const p = spawn('bash', [startScript], {
                            detached: true,
                            stdio: 'ignore'
                        });
                        p.unref();
                    } else {
                        const uvCmd = resolveUvCommand();
                        const p = spawn(uvCmd, ['run', '--with', 'fastembed', 'python3', DAEMON_SCRIPT], {
                            detached: true,
                            stdio: 'ignore'
                        });
                        p.unref();
                    }
                }
            } catch (err) {
                // Ignore spawn errors; fallback deterministic embedding remains active
            }
        }
    }).catch(() => {});
}

/**
 * Fallback deterministic 384-dimensional vector generator
 * Used strictly if daemon is initializing or unreachable (Zero-Crash Guarantee).
 */
function computeFallbackVector(text) {
    const vec = new Float32Array(VECTOR_DIM);
    if (!text || typeof text !== 'string') return vec;

    const tokens = text.toLowerCase().replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ').split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return vec;

    for (const token of tokens) {
        let h = 0x12345678;
        for (let i = 0; i < token.length; i++) {
            h = Math.imul(h ^ token.charCodeAt(i), 0x5bd1e995);
            h ^= h >>> 15;
        }
        const idx = Math.abs(h) % VECTOR_DIM;
        vec[idx] += (h & 1) ? 1.0 : -1.0;
    }

    return normalizeL2(vec);
}

/**
 * Computes a 384-dimensional multilingual dense embedding using the local neural daemon.
 * @param {string} text
 * @returns {Promise<Float32Array>}
 */
async function computeEmbedding(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
        return new Float32Array(VECTOR_DIM);
    }

    const trimmed = text.trim();
    if (_embeddingCache.has(trimmed)) {
        return _embeddingCache.get(trimmed);
    }

    if (process.env.NODE_ENV === 'test') {
        return computeFallbackVector(trimmed);
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200); // 1.2s safety ceiling

        const res = await fetch(`${DAEMON_URL}/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: [trimmed] }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
            const data = await res.json();
            if (data.embeddings && data.embeddings.length > 0) {
                const rawVec = data.embeddings[0];
                const floatVec = normalizeL2(new Float32Array(rawVec));

                // Cache management
                if (_embeddingCache.size >= MAX_CACHE_SIZE) {
                    const firstKey = _embeddingCache.keys().next().value;
                    _embeddingCache.delete(firstKey);
                }
                _embeddingCache.set(trimmed, floatVec);

                return floatVec;
            }
        }
    } catch (err) {
        // Fall through to fallback & trigger auto-spawn
        ensureDaemonRunning();
    }

    // Return fallback vector if daemon didn't answer in time
    const fallback = computeFallbackVector(trimmed);
    return fallback;
}

/**
 * Synchronous embedding getter from cache or fallback.
 * @param {string} text
 * @returns {Float32Array}
 */
function computeEmbeddingSync(text) {
    if (!text || !text.trim()) return new Float32Array(VECTOR_DIM);
    const trimmed = text.trim();
    if (_embeddingCache.has(trimmed)) {
        return _embeddingCache.get(trimmed);
    }
    return computeFallbackVector(trimmed);
}

/**
 * Computes Cosine Similarity between two normalized Float32Array vectors.
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
    }
    return Math.max(-1, Math.min(1, dot));
}

function vectorToBuffer(vec) {
    return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

function bufferToVector(buf) {
    if (!buf) return null;
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

/**
 * Reports structured health state of the vector embedding subsystem.
 */
async function getEmbeddingHealth() {
    if (process.env.NODE_ENV === 'test') {
        return {
            status: 'READY',
            mode: 'test_fallback',
            dimension: VECTOR_DIM,
            message: 'Môi trường kiểm thử (Deterministic 384-dim fallback).'
        };
    }

    const healthy = await isDaemonHealthy();
    if (healthy) {
        return {
            status: 'READY',
            mode: 'neural_daemon',
            daemonUrl: DAEMON_URL,
            dimension: VECTOR_DIM,
            message: 'FastEmbed Multilingual Daemon đang hoạt động hoàn hảo.'
        };
    }

    return {
        status: 'DEGRADED',
        mode: 'deterministic_fallback',
        daemonUrl: DAEMON_URL,
        dimension: VECTOR_DIM,
        message: 'Daemon chưa kết nối, tự động fallback về Deterministic Hash Vectors.'
    };
}

module.exports = {
    VECTOR_DIM,
    computeEmbedding,
    computeEmbeddingSync,
    ensureDaemonRunning,
    isDaemonHealthy,
    getEmbeddingHealth,
    cosineSimilarity,
    vectorToBuffer,
    bufferToVector
};
