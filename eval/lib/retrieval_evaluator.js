// ==============================================================================
// Antigravity Second Brain: Retrieval Benchmark Evaluator
// Measures Recall@K, Precision@K, MRR, NDCG@5, and Latency Percentiles
// ==============================================================================

const path = require('node:path');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { TestEnvironment } = require('./test_environment');
const { aggregateRetrievalMetrics } = require('./metrics');

const DATASETS_DIR = path.resolve(__dirname, '..', 'datasets');
const DEFAULT_BENCHMARK_PATH = path.join(DATASETS_DIR, 'retrieval_benchmark.json');

class RetrievalEvaluator {
    constructor(options = {}) {
        this.benchmarkPath = options.benchmarkPath || DEFAULT_BENCHMARK_PATH;
        this.runsPerQuery = options.runsPerQuery || 3;
        this.topK = options.topK || 10;
        this.testEnv = options.testEnv || new TestEnvironment();
    }

    loadBenchmark() {
        if (!fs.existsSync(this.benchmarkPath)) {
            throw new Error(`Retrieval benchmark dataset not found at: ${this.benchmarkPath}`);
        }
        return JSON.parse(fs.readFileSync(this.benchmarkPath, 'utf8'));
    }

    async run() {
        const queries = this.loadBenchmark();
        this.testEnv.setup();

        try {
            const semantic = this.testEnv.getSemanticKnowledge();
            const solutions = this.testEnv.getSolutionStore();
            const retriever = this.testEnv.getContextRetriever();

            // 1. Warm-up run to eliminate cold-start noise
            try {
                await semantic.searchKnowledge('warmup query initialization', { limit: 3 });
                solutions.searchSolutions('warmup error pattern', { limit: 3 });
            } catch (e) {}

            const queryResults = [];

            for (const q of queries) {
                const latencies = [];
                let lastRetrievedIds = [];

                for (let runIdx = 0; runIdx < this.runsPerQuery; runIdx++) {
                    const start = performance.now();
                    let results = [];

                    if (q.target_store === 'solutions') {
                        results = solutions.searchSolutions(q.query, { limit: this.topK });
                        lastRetrievedIds = results.map(r => r.id);
                    } else if (q.target_store === 'context') {
                        const contextText = await retriever.compileContext(q.query, null, { maxTokens: 800 });
                        // Match relevant IDs against context text or fall back to semantic
                        results = await semantic.searchKnowledge(q.query, { limit: this.topK });
                        lastRetrievedIds = results.map(r => r.id);
                    } else {
                        // Default: semantic knowledge hybrid search
                        results = await semantic.searchKnowledge(q.query, { limit: this.topK });
                        lastRetrievedIds = results.map(r => r.id);
                    }

                    const elapsed = performance.now() - start;
                    latencies.push(elapsed);
                }

                // Median latency of repeated runs for stability
                latencies.sort((a, b) => a - b);
                const medianLatency = latencies[Math.floor(latencies.length / 2)];

                queryResults.push({
                    id: q.id,
                    query: q.query,
                    scenario: q.scenario,
                    targetStore: q.target_store,
                    relevantIds: q.relevant_ids,
                    primaryTargetId: q.primary_target_id,
                    gradedRel: q.graded_relevance || {},
                    retrievedIds: lastRetrievedIds,
                    latencyMs: Number(medianLatency.toFixed(2)),
                    allLatencies: latencies
                });
            }

            const aggregated = aggregateRetrievalMetrics(queryResults);

            return {
                timestamp: new Date().toISOString(),
                total_queries: queries.length,
                overall: aggregated.overall,
                by_scenario: aggregated.by_scenario,
                detailed_queries: queryResults
            };
        } finally {
            this.testEnv.teardown();
        }
    }
}

module.exports = {
    RetrievalEvaluator
};
