#!/usr/bin/env node
// ==============================================================================
// Antigravity Second Brain: Unified Evaluation Suite Runner
// Executes Benchmarks, Computes IR/Extraction Metrics, and Enforces Regression Gates
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { RetrievalEvaluator } = require('./lib/retrieval_evaluator');
const { ReflectionEvaluator } = require('./lib/reflection_evaluator');
const { CompatibilityEvaluator } = require('./lib/compat_evaluator');
const { Reporter } = require('./lib/reporter');

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        suite: 'all',
        compareBaseline: null,
        threshold: 0.02,
        output: null,
        format: 'table',
        topK: 10
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--suite' && i + 1 < args.length) {
            options.suite = args[++i].toLowerCase();
        } else if (arg === '--compare-baseline' && i + 1 < args.length) {
            options.compareBaseline = path.resolve(process.cwd(), args[++i]);
        } else if (arg === '--threshold' && i + 1 < args.length) {
            options.threshold = parseFloat(args[++i]);
        } else if (arg === '--output' && i + 1 < args.length) {
            options.output = path.resolve(process.cwd(), args[++i]);
        } else if (arg === '--format' && i + 1 < args.length) {
            options.format = args[++i].toLowerCase();
        } else if (arg === '--top-k' && i + 1 < args.length) {
            options.topK = parseInt(args[++i], 10);
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Antigravity Second Brain Evaluation Suite Runner

Usage:
  node eval/run_eval.js [options]

Options:
  --suite <all|retrieval|reflection|compat>   Suite to execute (default: all)
  --compare-baseline <path>                   Path to baseline JSON report for regression gate
  --threshold <float>                         Allowable regression margin (default: 0.02)
  --output <path>                             Path to save structured JSON report
  --format <table|json>                       Display format (default: table)
  --top-k <int>                               Top-K candidate cutoff for retrieval (default: 10)
  --help, -h                                  Show this help message
`);
            process.exit(0);
        }
    }

    return options;
}

function checkRegressions(evalData, baselineData, threshold = 0.02) {
    const failures = [];
    const deltas = {};

    // 1. Retrieval regression gates
    if (evalData.retrieval_metrics && baselineData.retrieval_metrics) {
        const cur = evalData.retrieval_metrics.overall;
        const base = baselineData.retrieval_metrics.overall;

        const r5Delta = cur.recall_at_5 - base.recall_at_5;
        deltas.recall_at_5 = (r5Delta >= 0 ? '+' : '') + r5Delta.toFixed(3);
        if (r5Delta < -threshold) {
            failures.push({
                metric: 'Recall@5',
                current: cur.recall_at_5,
                baseline: base.recall_at_5,
                delta: r5Delta,
                reason: `Recall@5 dropped by ${(-r5Delta).toFixed(3)}, exceeding threshold ${threshold}`
            });
        }

        const mrrDelta = cur.mrr - base.mrr;
        deltas.mrr = (mrrDelta >= 0 ? '+' : '') + mrrDelta.toFixed(3);
        if (mrrDelta < -Math.max(threshold, 0.03)) {
            failures.push({
                metric: 'MRR',
                current: cur.mrr,
                baseline: base.mrr,
                delta: mrrDelta,
                reason: `MRR dropped by ${(-mrrDelta).toFixed(3)}, exceeding threshold 0.03`
            });
        }

        if (cur.latency_ms && base.latency_ms && base.latency_ms.p95 > 0) {
            const p95Ratio = (cur.latency_ms.p95 - base.latency_ms.p95) / base.latency_ms.p95;
            deltas.latency_p95 = `${cur.latency_ms.p95 >= base.latency_ms.p95 ? '+' : ''}${(cur.latency_ms.p95 - base.latency_ms.p95).toFixed(1)}ms`;
            if (p95Ratio > 0.20 && cur.latency_ms.p95 > 50) {
                failures.push({
                    metric: 'Latency p95',
                    current: cur.latency_ms.p95,
                    baseline: base.latency_ms.p95,
                    delta: p95Ratio,
                    reason: `p95 Latency increased by ${(p95Ratio * 100).toFixed(1)}%, exceeding 20% limit`
                });
            }
        }
    }

    // 2. Reflection regression gates
    if (evalData.reflection_metrics && baselineData.reflection_metrics) {
        const cur = evalData.reflection_metrics.overall;
        const base = baselineData.reflection_metrics.overall;

        const f1Delta = cur.f1_score - base.f1_score;
        deltas.f1_score = (f1Delta >= 0 ? '+' : '') + f1Delta.toFixed(3);
        if (f1Delta < -threshold) {
            failures.push({
                metric: 'F1-Score',
                current: cur.f1_score,
                baseline: base.f1_score,
                delta: f1Delta,
                reason: `Reflection F1 score dropped by ${(-f1Delta).toFixed(3)}, exceeding threshold ${threshold}`
            });
        }
    }

    // 3. Compatibility gates
    if (evalData.compatibility) {
        if (!evalData.compatibility.mcp_server.passed) {
            failures.push({
                metric: 'MCP Server',
                reason: 'MCP tools failed backward compatibility check'
            });
        }
        if (!evalData.compatibility.cli_commands.passed) {
            failures.push({
                metric: 'CLI Commands',
                reason: 'CLI commands failed backward compatibility check'
            });
        }
        if (evalData.compatibility.database_integrity.status !== 'PASSED') {
            failures.push({
                metric: 'Database Integrity',
                reason: 'Database schema invariance or PRAGMA check failed'
            });
        }
    }

    return {
        passed: failures.length === 0,
        failures,
        deltas
    };
}

async function main() {
    const options = parseArgs();
    const startTime = Date.now();

    let pkgVersion = '3.8.0';
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        if (pkg.version) pkgVersion = pkg.version;
    } catch (e) {}

    const reportData = {
        timestamp: new Date().toISOString(),
        version: pkgVersion,
        suite: options.suite,
        runtime: {
            node: process.version,
            platform: process.platform,
            vector_dim: 384,
            daemon_healthy: false
        },
        retrieval_metrics: null,
        reflection_metrics: null,
        compatibility: null,
        regression_check: null
    };

    // Check daemon status if embedding module is present
    try {
        const { isDaemonHealthy } = require('../src/embedding');
        reportData.runtime.daemon_healthy = await isDaemonHealthy();
    } catch (e) {}

    // Execute selected suites
    const runAll = options.suite === 'all';

    if (runAll || options.suite === 'retrieval') {
        const retEval = new RetrievalEvaluator({ topK: options.topK });
        const retRes = await retEval.run();
        reportData.retrieval_metrics = {
            overall: retRes.overall,
            by_scenario: retRes.by_scenario
        };
    }

    if (runAll || options.suite === 'reflection') {
        const refEval = new ReflectionEvaluator();
        const refRes = await refEval.run();
        reportData.reflection_metrics = {
            overall: refRes.overall,
            by_category: refRes.by_category
        };
    }

    if (runAll || options.suite === 'compat') {
        const compEval = new CompatibilityEvaluator();
        const compRes = await compEval.run();
        reportData.compatibility = compRes;
    }

    // Baseline comparison & regression gating
    let baselineData = null;
    let regressionResult = null;

    if (options.compareBaseline) {
        if (fs.existsSync(options.compareBaseline)) {
            try {
                baselineData = JSON.parse(fs.readFileSync(options.compareBaseline, 'utf8'));
                regressionResult = checkRegressions(reportData, baselineData, options.threshold);
                reportData.regression_check = {
                    baseline_path: options.compareBaseline,
                    status: regressionResult.passed ? 'PASSED' : 'FAILED',
                    threshold: options.threshold,
                    deltas: regressionResult.deltas,
                    failures: regressionResult.failures
                };
            } catch (err) {
                console.error(`Error loading baseline file at ${options.compareBaseline}:`, err.message);
            }
        } else {
            console.warn(`Baseline file not found at: ${options.compareBaseline}. Skipping comparison.`);
        }
    }

    // Output handling
    const reporter = new Reporter({ outputPath: options.output });
    if (options.output) {
        const savedPath = reporter.saveJson(reportData);
        if (options.format !== 'json') {
            console.log(`Structured evaluation report saved to: ${savedPath}`);
        }
    }

    if (options.format === 'json') {
        console.log(JSON.stringify(reportData, null, 2));
    } else {
        const dashboard = reporter.renderDashboard(reportData, baselineData, regressionResult);
        console.log(dashboard);
    }

    // Regression gate enforcement
    if (regressionResult && !regressionResult.passed) {
        console.error('❌ REGRESSION GATE FAILED:');
        for (const f of regressionResult.failures) {
            console.error(`  • [${f.metric}] ${f.reason}`);
        }
        process.exit(1);
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal Evaluation Suite Runner Error:', err);
    process.exit(1);
});
