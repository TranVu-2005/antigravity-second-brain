// ==============================================================================
// Antigravity Second Brain: Reflection & Fact Extraction Evaluator
// Benchmarks Precision, Recall, F1, and Conflict Resolution Accuracy
// ==============================================================================

const path = require('node:path');
const fs = require('node:fs');
const { TestEnvironment } = require('./test_environment');
const { calculateClassificationMetrics, calculateExtractionMetrics } = require('./metrics');

const DATASETS_DIR = path.resolve(__dirname, '..', 'datasets');
const DEFAULT_BENCHMARK_PATH = path.join(DATASETS_DIR, 'reflection_benchmark.json');

class ReflectionEvaluator {
    constructor(options = {}) {
        this.benchmarkPath = options.benchmarkPath || DEFAULT_BENCHMARK_PATH;
        this.testEnv = options.testEnv || new TestEnvironment();
    }

    loadBenchmark() {
        if (!fs.existsSync(this.benchmarkPath)) {
            throw new Error(`Reflection benchmark dataset not found at: ${this.benchmarkPath}`);
        }
        return JSON.parse(fs.readFileSync(this.benchmarkPath, 'utf8'));
    }

    async run() {
        const dialogues = this.loadBenchmark();
        this.testEnv.setup();

        try {
            const dialogueResults = [];
            const categoryBuckets = {
                profile: { tp: 0, fp: 0, fn: 0 },
                rule: { tp: 0, fp: 0, fn: 0 },
                procedural: { tp: 0, fp: 0, fn: 0 },
                entity: { tp: 0, fp: 0, fn: 0 }
            };

            let conflictResolutionTests = 0;
            let conflictResolutionPassed = 0;
            let deduplicationTests = 0;
            let deduplicationPassed = 0;

            for (const d of dialogues) {
                // Reset test database to clean seed state for each dialogue
                this.testEnv.reset();
                const extractor = this.testEnv.getMemoryExtractor();
                const allExtractions = [];

                // Replay dialogue turns sequentially
                for (const turn of d.turns) {
                    const extractions = extractor.extractFromText(turn.content, turn.role || 'user');
                    allExtractions.push(...extractions);
                }

                let dTp = 0;
                let dFp = 0;
                let dFn = 0;

                // Evaluate based on dialogue type / category
                if (d.id === 'D-04') {
                    // Negative Control: extractions must be exactly 0
                    if (allExtractions.length === 0) {
                        dTp = 0;
                        dFp = 0;
                        dFn = 0;
                    } else {
                        dFp = allExtractions.length;
                    }
                } else if (d.id === 'D-05') {
                    // Dynamic Conflict Resolution
                    conflictResolutionTests++;
                    const locRows = this.testEnv.db.all("SELECT value FROM user_profile WHERE key = 'location'");
                    const hasSingleRecord = locRows.length === 1;
                    const val = locRows.length > 0 ? locRows[0].value : '';
                    const hasNewValue = val.toLowerCase().includes('hoàng mai');
                    const notOldValue = !val.toLowerCase().includes('cầu giấy');

                    if (hasSingleRecord && hasNewValue && notOldValue) {
                        conflictResolutionPassed++;
                        dTp = 1;
                    } else if (hasNewValue) {
                        // Updated but duplicated or retained old value
                        dTp = 1;
                        dFp = 1;
                    } else {
                        dFn = 1;
                    }
                    categoryBuckets.profile.tp += dTp;
                    categoryBuckets.profile.fp += dFp;
                    categoryBuckets.profile.fn += dFn;
                } else if (d.id === 'D-01') {
                    // Profile Expansion (tech preference)
                    const foundProf = allExtractions.some(e => 
                        e.type === 'profile' && 
                        (e.category === 'tech_stack' || (e.key && e.key.includes('tech_pref'))) &&
                        (e.value && (e.value.includes('Rust') || e.value.includes('Go')))
                    );

                    if (foundProf) {
                        dTp = 1;
                        dFp = Math.max(0, allExtractions.length - 1);
                    } else {
                        dFn = 1;
                        dFp = allExtractions.length;
                    }
                    categoryBuckets.profile.tp += dTp;
                    categoryBuckets.profile.fp += dFp;
                    categoryBuckets.profile.fn += dFn;
                } else if (d.id === 'D-02') {
                    // Permanent Directive / Rule
                    const foundRule = allExtractions.some(e =>
                        e.type === 'knowledge' &&
                        e.category === 'rule' &&
                        (e.content.toLowerCase().includes('unit test') || e.content.toLowerCase().includes('vitest') || e.content.toLowerCase().includes('jest'))
                    );

                    if (foundRule) {
                        dTp = 1;
                        dFp = Math.max(0, allExtractions.length - 1);
                    } else {
                        dFn = 1;
                        dFp = allExtractions.length;
                    }
                    categoryBuckets.rule.tp += dTp;
                    categoryBuckets.rule.fp += dFp;
                    categoryBuckets.rule.fn += dFn;
                } else if (d.id === 'D-03') {
                    // Procedural Bug Troubleshooting
                    const foundSol = allExtractions.some(e =>
                        e.type === 'solution' &&
                        e.error_pattern && e.error_pattern.toLowerCase().includes('p1001') &&
                        e.solution_code && e.solution_code.toLowerCase().includes('docker start')
                    );

                    if (foundSol) {
                        dTp = 1;
                        dFp = Math.max(0, allExtractions.length - 1);
                    } else {
                        dFn = 1;
                        dFp = allExtractions.length;
                    }
                    categoryBuckets.procedural.tp += dTp;
                    categoryBuckets.procedural.fp += dFp;
                    categoryBuckets.procedural.fn += dFn;
                }

                // General deduplication test check (replaying identical user turn shouldn't duplicate)
                deduplicationTests++;
                const turn1 = d.turns[0];
                const preCount = this.testEnv.db.get("SELECT COUNT(*) as cnt FROM knowledge_items").cnt;
                extractor.extractFromText(turn1.content, turn1.role || 'user');
                const postCount = this.testEnv.db.get("SELECT COUNT(*) as cnt FROM knowledge_items").cnt;
                if (postCount === preCount || (d.id !== 'D-02' && postCount <= preCount + 1)) {
                    deduplicationPassed++;
                }

                dialogueResults.push({
                    id: d.id,
                    title: d.title,
                    category: d.category,
                    extractionsCount: allExtractions.length,
                    extractions: allExtractions,
                    tp: dTp,
                    fp: dFp,
                    fn: dFn,
                    metrics: calculateClassificationMetrics(dTp, dFp, dFn)
                });
            }

            const extractionMetrics = calculateExtractionMetrics(categoryBuckets);

            return {
                timestamp: new Date().toISOString(),
                total_dialogues: dialogues.length,
                overall: {
                    precision: extractionMetrics.overall.precision,
                    recall: extractionMetrics.overall.recall,
                    f1_score: extractionMetrics.overall.f1,
                    tp: extractionMetrics.overall.tp,
                    fp: extractionMetrics.overall.fp,
                    fn: extractionMetrics.overall.fn,
                    deduplication_accuracy: Number((deduplicationPassed / Math.max(1, deduplicationTests)).toFixed(3)),
                    conflict_resolution_accuracy: Number((conflictResolutionPassed / Math.max(1, conflictResolutionTests)).toFixed(3))
                },
                by_category: extractionMetrics.by_category,
                detailed_dialogues: dialogueResults
            };
        } finally {
            this.testEnv.teardown();
        }
    }
}

module.exports = {
    ReflectionEvaluator
};
