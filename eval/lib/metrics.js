// ==============================================================================
// Antigravity Second Brain: Evaluation Suite Metrics Engine
// Quantitative Information Retrieval (IR) & Fact Extraction Metrics
// ==============================================================================

/**
 * Computes Recall@K for a retrieved list of IDs against relevant IDs.
 * Recall@K = |Retrieved[0..K] ∩ Relevant| / |Relevant|
 *
 * @param {Array<number|string>} retrieved - Array of retrieved item IDs in ranked order
 * @param {Array<number|string>} relevant - Ground truth array of relevant item IDs
 * @param {number} k - Cutoff rank (e.g. 1, 3, 5, 10)
 * @returns {number} Score in range [0.0, 1.0]
 */
function recallAtK(retrieved, relevant, k) {
    if (!relevant || relevant.length === 0) return 0;
    if (!retrieved || retrieved.length === 0 || k <= 0) return 0;

    const topK = retrieved.slice(0, k);
    const relevantSet = new Set(relevant.map(String));
    let hits = 0;

    for (const item of topK) {
        if (relevantSet.has(String(item))) {
            hits++;
        }
    }

    return hits / relevant.length;
}

/**
 * Computes Precision@K for a retrieved list of IDs against relevant IDs.
 * Precision@K = |Retrieved[0..K] ∩ Relevant| / K
 *
 * @param {Array<number|string>} retrieved - Array of retrieved item IDs in ranked order
 * @param {Array<number|string>} relevant - Ground truth array of relevant item IDs
 * @param {number} k - Cutoff rank (e.g. 1, 3, 5, 10)
 * @returns {number} Score in range [0.0, 1.0]
 */
function precisionAtK(retrieved, relevant, k) {
    if (k <= 0) return 0;
    if (!relevant || relevant.length === 0 || !retrieved || retrieved.length === 0) return 0;

    const topK = retrieved.slice(0, k);
    const relevantSet = new Set(relevant.map(String));
    let hits = 0;

    for (const item of topK) {
        if (relevantSet.has(String(item))) {
            hits++;
        }
    }

    return hits / k;
}

/**
 * Computes Reciprocal Rank (RR) for a single query.
 * RR = 1 / rank of first relevant item (or 0 if no relevant items retrieved).
 *
 * @param {Array<number|string>} retrieved - Array of retrieved item IDs in ranked order
 * @param {Array<number|string>} relevant - Ground truth array of relevant item IDs
 * @returns {number} Score in range [0.0, 1.0]
 */
function reciprocalRank(retrieved, relevant) {
    if (!relevant || relevant.length === 0 || !retrieved || retrieved.length === 0) return 0;

    const relevantSet = new Set(relevant.map(String));
    for (let i = 0; i < retrieved.length; i++) {
        if (relevantSet.has(String(retrieved[i]))) {
            return 1 / (i + 1);
        }
    }

    return 0;
}

/**
 * Computes Discounted Cumulative Gain at rank K (DCG@K).
 * DCG@K = sum_{i=1}^K (2^{r_i} - 1) / log2(i + 1)
 *
 * @param {Array<number|string>} retrieved - Array of retrieved item IDs in ranked order
 * @param {Object.<string, number>} gradedRel - Map of item ID (string) to relevance grade (e.g. { "8": 3, "9": 2 })
 * @param {number} k - Cutoff rank
 * @returns {number}
 */
function dcgAtK(retrieved, gradedRel = {}, k = 5) {
    if (!retrieved || retrieved.length === 0 || k <= 0) return 0;

    let dcg = 0;
    const limit = Math.min(k, retrieved.length);

    for (let i = 0; i < limit; i++) {
        const idStr = String(retrieved[i]);
        const grade = Number(gradedRel[idStr]) || 0;
        if (grade > 0) {
            const gain = Math.pow(2, grade) - 1;
            const discount = Math.log2(i + 2); // i is 0-based, so rank is i+1, log2(rank + 1) = log2(i + 2)
            dcg += gain / discount;
        }
    }

    return dcg;
}

/**
 * Computes Ideal Discounted Cumulative Gain at rank K (IDCG@K).
 *
 * @param {Object.<string, number>} gradedRel - Map of item ID (string) to relevance grade
 * @param {number} k - Cutoff rank
 * @returns {number}
 */
function idcgAtK(gradedRel = {}, k = 5) {
    if (!gradedRel || k <= 0) return 0;

    const grades = Object.values(gradedRel)
        .map(Number)
        .filter(g => g > 0)
        .sort((a, b) => b - a);

    let idcg = 0;
    const limit = Math.min(k, grades.length);

    for (let i = 0; i < limit; i++) {
        const gain = Math.pow(2, grades[i]) - 1;
        const discount = Math.log2(i + 2);
        idcg += gain / discount;
    }

    return idcg;
}

/**
 * Computes Normalized Discounted Cumulative Gain at rank K (NDCG@K).
 * NDCG@K = DCG@K / IDCG@K
 *
 * @param {Array<number|string>} retrieved - Array of retrieved item IDs in ranked order
 * @param {Object.<string, number>} gradedRel - Map of item ID (string) to relevance grade
 * @param {number} k - Cutoff rank (default: 5)
 * @returns {number} Score in range [0.0, 1.0]
 */
function ndcgAtK(retrieved, gradedRel = {}, k = 5) {
    const idcg = idcgAtK(gradedRel, k);
    if (idcg === 0) {
        // If there are no positive graded items, check if retrieved has any positive items
        const dcg = dcgAtK(retrieved, gradedRel, k);
        return dcg === 0 ? 1.0 : 0.0;
    }

    const dcg = dcgAtK(retrieved, gradedRel, k);
    return Math.min(1.0, dcg / idcg);
}

/**
 * Calculates latency percentiles (p50, p95, p99, mean, min, max) from an array of millisecond timings.
 *
 * @param {Array<number>} latencies - Array of latency numbers in milliseconds
 * @returns {{ p50: number, p95: number, p99: number, mean: number, min: number, max: number, count: number }}
 */
function calculateLatencyStats(latencies = []) {
    if (!latencies || latencies.length === 0) {
        return { p50: 0, p95: 0, p99: 0, mean: 0, min: 0, max: 0, count: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = Number((sum / count).toFixed(2));
    const min = Number(sorted[0].toFixed(2));
    const max = Number(sorted[count - 1].toFixed(2));

    const getPercentile = (p) => {
        if (count === 1) return sorted[0];
        const index = (p / 100) * (count - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (upper >= count) return sorted[count - 1];
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    const p50 = Number(getPercentile(50).toFixed(2));
    const p95 = Number(getPercentile(95).toFixed(2));
    const p99 = Number(getPercentile(99).toFixed(2));

    return { p50, p95, p99, mean, min, max, count };
}

/**
 * Calculates Precision, Recall, and F1 from TP, FP, FN counts.
 *
 * @param {number} tp - True Positives
 * @param {number} fp - False Positives
 * @param {number} fn - False Negatives
 * @returns {{ precision: number, recall: number, f1: number, tp: number, fp: number, fn: number }}
 */
function calculateClassificationMetrics(tp = 0, fp = 0, fn = 0) {
    let precision = 0;
    if (tp + fp > 0) {
        precision = tp / (tp + fp);
    } else if (fn === 0) {
        // Zero extractions expected and zero produced (e.g. negative control)
        precision = 1.0;
    }

    let recall = 0;
    if (tp + fn > 0) {
        recall = tp / (tp + fn);
    } else if (fp === 0) {
        recall = 1.0;
    }

    let f1 = 0;
    if (precision + recall > 0) {
        f1 = (2 * precision * recall) / (precision + recall);
    }

    return {
        precision: Number(precision.toFixed(3)),
        recall: Number(recall.toFixed(3)),
        f1: Number(f1.toFixed(3)),
        tp,
        fp,
        fn
    };
}

/**
 * Aggregates extraction metrics across multi-domain categories:
 * - Profile (user_profile key-values)
 * - Rule (knowledge_items category='rule')
 * - Procedural (solutions table)
 * - Entity (entities & entity_relations)
 *
 * @param {Object.<string, { tp: number, fp: number, fn: number }>} categories
 * @returns {Object} Full breakdown with category and overall metrics
 */
function calculateExtractionMetrics(categories = {}) {
    const result = {
        by_category: {},
        overall: null
    };

    let totalTp = 0;
    let totalFp = 0;
    let totalFn = 0;

    for (const [cat, counts] of Object.entries(categories)) {
        const tp = counts.tp || 0;
        const fp = counts.fp || 0;
        const fn = counts.fn || 0;

        totalTp += tp;
        totalFp += fp;
        totalFn += fn;

        result.by_category[cat] = calculateClassificationMetrics(tp, fp, fn);
    }

    result.overall = calculateClassificationMetrics(totalTp, totalFp, totalFn);
    return result;
}

/**
 * Aggregates Information Retrieval metrics across a collection of query evaluation results.
 * Each item in queryResults is expected to have:
 * - retrievedIds: Array<number|string>
 * - relevantIds: Array<number|string>
 * - gradedRel: Object.<string, number>
 * - latencyMs: number
 * - scenario: string ('keyword_exact' | 'semantic_paraphrase' | 'multi_hop' | 'temporal')
 *
 * @param {Array<Object>} queryResults
 * @returns {Object} Aggregated metrics overall and by scenario
 */
function aggregateRetrievalMetrics(queryResults = []) {
    if (!queryResults || queryResults.length === 0) {
        return {
            overall: {
                recall_at_1: 0,
                recall_at_3: 0,
                recall_at_5: 0,
                recall_at_10: 0,
                precision_at_1: 0,
                precision_at_3: 0,
                precision_at_5: 0,
                precision_at_10: 0,
                mrr: 0,
                ndcg_at_5: 0,
                query_count: 0,
                latency_ms: calculateLatencyStats([])
            },
            by_scenario: {}
        };
    }

    const scenarios = {};
    const latencies = [];

    let sumR1 = 0, sumR3 = 0, sumR5 = 0, sumR10 = 0;
    let sumP1 = 0, sumP3 = 0, sumP5 = 0, sumP10 = 0;
    let sumRR = 0;
    let sumNDCG5 = 0;

    for (const q of queryResults) {
        const r1 = recallAtK(q.retrievedIds, q.relevantIds, 1);
        const r3 = recallAtK(q.retrievedIds, q.relevantIds, 3);
        const r5 = recallAtK(q.retrievedIds, q.relevantIds, 5);
        const r10 = recallAtK(q.retrievedIds, q.relevantIds, 10);

        const p1 = precisionAtK(q.retrievedIds, q.relevantIds, 1);
        const p3 = precisionAtK(q.retrievedIds, q.relevantIds, 3);
        const p5 = precisionAtK(q.retrievedIds, q.relevantIds, 5);
        const p10 = precisionAtK(q.retrievedIds, q.relevantIds, 10);

        const rr = reciprocalRank(q.retrievedIds, q.relevantIds);
        const ndcg5 = ndcgAtK(q.retrievedIds, q.gradedRel, 5);

        sumR1 += r1; sumR3 += r3; sumR5 += r5; sumR10 += r10;
        sumP1 += p1; sumP3 += p3; sumP5 += p5; sumP10 += p10;
        sumRR += rr;
        sumNDCG5 += ndcg5;

        if (typeof q.latencyMs === 'number') {
            latencies.push(q.latencyMs);
        }

        const sc = q.scenario || 'unclassified';
        if (!scenarios[sc]) {
            scenarios[sc] = {
                items: [],
                sumR3: 0,
                sumR5: 0,
                sumRR: 0,
                sumNDCG5: 0,
                latencies: []
            };
        }
        scenarios[sc].items.push(q);
        scenarios[sc].sumR3 += r3;
        scenarios[sc].sumR5 += r5;
        scenarios[sc].sumRR += rr;
        scenarios[sc].sumNDCG5 += ndcg5;
        if (typeof q.latencyMs === 'number') {
            scenarios[sc].latencies.push(q.latencyMs);
        }
    }

    const n = queryResults.length;
    const overall = {
        recall_at_1: Number((sumR1 / n).toFixed(3)),
        recall_at_3: Number((sumR3 / n).toFixed(3)),
        recall_at_5: Number((sumR5 / n).toFixed(3)),
        recall_at_10: Number((sumR10 / n).toFixed(3)),
        precision_at_1: Number((sumP1 / n).toFixed(3)),
        precision_at_3: Number((sumP3 / n).toFixed(3)),
        precision_at_5: Number((sumP5 / n).toFixed(3)),
        precision_at_10: Number((sumP10 / n).toFixed(3)),
        mrr: Number((sumRR / n).toFixed(3)),
        ndcg_at_5: Number((sumNDCG5 / n).toFixed(3)),
        query_count: n,
        latency_ms: calculateLatencyStats(latencies)
    };

    const byScenario = {};
    for (const [sc, data] of Object.entries(scenarios)) {
        const scCount = data.items.length;
        byScenario[sc] = {
            query_count: scCount,
            recall_at_3: Number((data.sumR3 / scCount).toFixed(3)),
            recall_at_5: Number((data.sumR5 / scCount).toFixed(3)),
            mrr: Number((data.sumRR / scCount).toFixed(3)),
            ndcg_at_5: Number((data.sumNDCG5 / scCount).toFixed(3)),
            latency_ms: calculateLatencyStats(data.latencies)
        };
    }

    return { overall, by_scenario: byScenario };
}

module.exports = {
    recallAtK,
    precisionAtK,
    reciprocalRank,
    dcgAtK,
    idcgAtK,
    ndcgAtK,
    calculateLatencyStats,
    calculateClassificationMetrics,
    calculateExtractionMetrics,
    aggregateRetrievalMetrics
};
