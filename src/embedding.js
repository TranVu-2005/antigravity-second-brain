// ==============================================================================
// Antigravity Second Brain: Dense Vector Embedding Engine
// Production-grade, zero-dependency local embedding with Semantic Concept Mapping
// ==============================================================================

const VECTOR_DIM = 128;

// Semantic Concept Clusters (bridges semantic gaps like "quanh nhà" <-> "Hoàng Mai")
const CONCEPT_CLUSTERS = [
    {
        name: 'geo_location_home',
        terms: ['hoàng mai', 'hà nội', 'quanh nhà', 'gần nhà', 'nơi ở', 'sinh sống', 'khu vực', 'ở đây', 'quê', 'nhà', 'location'],
        vectorIndex: 0
    },
    {
        name: 'identity_master',
        terms: ['ngài', 'sir', 'chủ nhân', 'bản thân', 'tôi', 'mình', 'profile', 'danh tính', 'ai'],
        vectorIndex: 8
    },
    {
        name: 'tech_stack',
        terms: ['code', 'lập trình', 'developer', 'node', 'python', 'sqlite', 'typescript', 'javascript', 'antigravity', 'api', 'backend', 'frontend'],
        vectorIndex: 16
    },
    {
        name: 'system_architecture',
        terms: ['kiến trúc', 'hệ thống', 'bộ nhớ', 'second brain', 'memory', 'database', 'fts5', 'bm25', 'vector', 'embedding', 'cache'],
        vectorIndex: 24
    },
    {
        name: 'rules_directives',
        terms: ['quy tắc', 'chỉ thị', 'luôn luôn', 'sau này', 'nhớ kỹ', 'hãy luôn', 'yêu cầu', 'rule', 'directive', 'ponytail'],
        vectorIndex: 32
    },
    {
        name: 'daily_life_weather',
        terms: ['thời tiết', 'mưa', 'nắng', 'nhiệt độ', 'ăn', 'uống', 'quán', 'đồ ăn', 'food', 'weather'],
        vectorIndex: 40
    }
];

function tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text
        .toLowerCase()
        .replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ')
        .split(/\s+/)
        .filter(t => t.length > 0);
}

// Murmur-inspired fast hash for n-grams
function hashString(str, seed = 0) {
    let h = seed ^ 0x12345678;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
        h ^= h >>> 15;
    }
    return Math.abs(h);
}

/**
 * Computes a normalized 128-dimensional dense vector for a given text.
 * @param {string} text 
 * @returns {Float32Array}
 */
function computeEmbedding(text) {
    const vec = new Float32Array(VECTOR_DIM);
    const tokens = tokenize(text);
    const fullTextLower = text.toLowerCase();

    if (tokens.length === 0) return vec;

    // 1. Concept Cluster Injections (High Semantic Signal)
    for (const cluster of CONCEPT_CLUSTERS) {
        let matchWeight = 0;
        for (const term of cluster.terms) {
            if (fullTextLower.includes(term)) {
                matchWeight += term.includes(' ') ? 2.5 : 1.5;
            }
        }
        if (matchWeight > 0) {
            // Distribute across 6 dimensional sub-band
            for (let j = 0; j < 6; j++) {
                const idx = (cluster.vectorIndex + j) % VECTOR_DIM;
                const sign = (j % 2 === 0) ? 1 : -0.7;
                vec[idx] += matchWeight * sign * 1.8;
            }
        }
    }

    // 2. Token Hashing with Subword 3-grams
    for (const token of tokens) {
        // Full token hash
        const hToken = hashString(token);
        const idxToken = hToken % VECTOR_DIM;
        const signToken = (hToken & 1) ? 1.0 : -1.0;
        vec[idxToken] += signToken * 1.2;

        // Character 3-grams for typo & morphology tolerance
        if (token.length >= 3) {
            for (let i = 0; i <= token.length - 3; i++) {
                const tri = token.slice(i, i + 3);
                const hTri = hashString(tri, 42);
                const idxTri = hTri % VECTOR_DIM;
                const signTri = (hTri & 1) ? 0.6 : -0.6;
                vec[idxTri] += signTri;
            }
        }
    }

    // 3. L2 Normalization (Unit Length)
    let sumSq = 0;
    for (let i = 0; i < VECTOR_DIM; i++) {
        sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
        for (let i = 0; i < VECTOR_DIM; i++) {
            vec[i] /= norm;
        }
    }

    return vec;
}

/**
 * Computes Cosine Similarity between two normalized vectors.
 * Since vectors are L2-normalized, Cosine Similarity is simply their dot product.
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

module.exports = {
    VECTOR_DIM,
    computeEmbedding,
    cosineSimilarity,
    vectorToBuffer,
    bufferToVector
};
