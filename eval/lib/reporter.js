// ==============================================================================
// Antigravity Second Brain: Evaluation Suite Reporter & Dashboard
// Formats Unicode Terminal Tables & Serializes Structured JSON Reports
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');

class Reporter {
    constructor(options = {}) {
        this.outputPath = options.outputPath || null;
    }

    /**
     * Serializes report data to JSON file.
     */
    saveJson(reportData, customPath = null) {
        const dest = customPath || this.outputPath;
        if (!dest) return null;

        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(dest, JSON.stringify(reportData, null, 2), 'utf8');
        return dest;
    }

    /**
     * Helper to format numbers or deltas.
     */
    _formatDelta(current, baseline, isLatency = false) {
        if (baseline === undefined || baseline === null) return '   -   ';
        const diff = current - baseline;
        const sign = diff >= 0 ? '+' : '';
        if (isLatency) {
            return `${sign}${diff.toFixed(1)}ms`;
        }
        return `${sign}${diff.toFixed(3)}`;
    }

    /**
     * Renders a human-readable Unicode terminal table.
     */
    renderDashboard(evalData, baselineData = null, regressionResult = null) {
        const lines = [];
        const sep = '═'.repeat(98);
        const thinSep = '─'.repeat(98);

        lines.push('');
        lines.push(sep);
        lines.push('🧠 ANTIGRAVITY SECOND BRAIN — BENCHMARK EVALUATION REPORT');
        lines.push(sep);

        const pad = (str, len) => String(str || '').padEnd(len);
        const padR = (str, len) => String(str || '').padStart(len);

        lines.push(`${pad('Suite', 18)} ${pad('Metric', 16)} ${padR('Current', 12)} ${padR('Baseline', 12)} ${padR('Delta', 12)}   ${pad('Status', 10)}`);
        lines.push(thinSep);

        const ret = evalData.retrieval_metrics ? evalData.retrieval_metrics.overall : null;
        const baseRet = baselineData && baselineData.retrieval_metrics ? baselineData.retrieval_metrics.overall : null;

        if (ret) {
            const addRow = (suite, metric, current, baseVal, isLatency = false, unit = '') => {
                const curStr = isLatency ? `${current.toFixed(1)}${unit}` : (typeof current === 'number' ? current.toFixed(3) : current);
                const baseStr = baseVal !== undefined && baseVal !== null
                    ? (isLatency ? `${baseVal.toFixed(1)}${unit}` : (typeof baseVal === 'number' ? baseVal.toFixed(3) : baseVal))
                    : '   -   ';
                const deltaStr = this._formatDelta(current, baseVal, isLatency);

                let status = '✅ PASS';
                if (regressionResult && regressionResult.failures) {
                    const fail = regressionResult.failures.find(f => f.metric.toLowerCase().includes(metric.toLowerCase()));
                    if (fail) status = '❌ FAIL';
                }

                lines.push(`${pad(suite, 18)} ${pad(metric, 16)} ${padR(curStr, 12)} ${padR(baseStr, 12)} ${padR(deltaStr, 12)}   ${pad(status, 10)}`);
            };

            addRow('Retrieval', 'Recall@1', ret.recall_at_1, baseRet ? baseRet.recall_at_1 : null);
            addRow('Retrieval', 'Recall@3', ret.recall_at_3, baseRet ? baseRet.recall_at_3 : null);
            addRow('Retrieval', 'Recall@5', ret.recall_at_5, baseRet ? baseRet.recall_at_5 : null);
            addRow('Retrieval', 'Recall@10', ret.recall_at_10, baseRet ? baseRet.recall_at_10 : null);
            addRow('Retrieval', 'MRR', ret.mrr, baseRet ? baseRet.mrr : null);
            addRow('Retrieval', 'NDCG@5', ret.ndcg_at_5, baseRet ? baseRet.ndcg_at_5 : null);

            if (ret.latency_ms) {
                addRow('Latency', 'p50 (Median)', ret.latency_ms.p50, baseRet && baseRet.latency_ms ? baseRet.latency_ms.p50 : null, true, ' ms');
                addRow('Latency', 'p95', ret.latency_ms.p95, baseRet && baseRet.latency_ms ? baseRet.latency_ms.p95 : null, true, ' ms');
                addRow('Latency', 'p99', ret.latency_ms.p99, baseRet && baseRet.latency_ms ? baseRet.latency_ms.p99 : null, true, ' ms');
            }
        }

        const ref = evalData.reflection_metrics ? evalData.reflection_metrics.overall : null;
        const baseRef = baselineData && baselineData.reflection_metrics ? baselineData.reflection_metrics.overall : null;

        if (ref) {
            lines.push(thinSep);
            const addRefRow = (metric, current, baseVal, isPercent = false) => {
                const curStr = isPercent ? `${(current * 100).toFixed(1)}%` : current.toFixed(3);
                const baseStr = baseVal !== undefined && baseVal !== null
                    ? (isPercent ? `${(baseVal * 100).toFixed(1)}%` : baseVal.toFixed(3))
                    : '   -   ';
                const deltaStr = isPercent && baseVal !== undefined && baseVal !== null
                    ? `${(current - baseVal >= 0 ? '+' : '')}${((current - baseVal) * 100).toFixed(1)}%`
                    : this._formatDelta(current, baseVal);

                let status = '✅ PASS';
                if (regressionResult && regressionResult.failures) {
                    const fail = regressionResult.failures.find(f => f.metric.toLowerCase().includes(metric.toLowerCase()));
                    if (fail) status = '❌ FAIL';
                }

                lines.push(`${pad('Reflection', 18)} ${pad(metric, 16)} ${padR(curStr, 12)} ${padR(baseStr, 12)} ${padR(deltaStr, 12)}   ${pad(status, 10)}`);
            };

            addRefRow('Precision', ref.precision, baseRef ? baseRef.precision : null);
            addRefRow('Recall', ref.recall, baseRef ? baseRef.recall : null);
            addRefRow('F1-Score', ref.f1_score, baseRef ? baseRef.f1_score : null);
            addRefRow('Conflict Res', ref.conflict_resolution_accuracy, baseRef ? baseRef.conflict_resolution_accuracy : null, true);
            addRefRow('Deduplication', ref.deduplication_accuracy, baseRef ? baseRef.deduplication_accuracy : null, true);
        }

        const comp = evalData.compatibility;
        if (comp) {
            lines.push(thinSep);
            const mcpStr = `${comp.mcp_server.calls_succeeded}/${comp.mcp_server.calls_tested} calls`;
            const cliStr = `${comp.cli_commands.passed_count}/${comp.cli_commands.total_count} cmds`;
            const dbStr = comp.database_integrity.status;

            lines.push(`${pad('Compatibility', 18)} ${pad('MCP Tools', 16)} ${padR(mcpStr, 12)} ${padR('-', 12)} ${padR('-', 12)}   ${pad(comp.mcp_server.passed ? '✅ PASS' : '❌ FAIL', 10)}`);
            lines.push(`${pad('Compatibility', 18)} ${pad('CLI Commands', 16)} ${padR(cliStr, 12)} ${padR('-', 12)} ${padR('-', 12)}   ${pad(comp.cli_commands.passed ? '✅ PASS' : '❌ FAIL', 10)}`);
            lines.push(`${pad('Database', 18)} ${pad('Schema Integrity', 16)} ${padR(dbStr, 12)} ${padR('-', 12)} ${padR('-', 12)}   ${pad(comp.database_integrity.status === 'PASSED' ? '✅ PASS' : '❌ FAIL', 10)}`);
        }

        lines.push(sep);

        const overallStatus = regressionResult
            ? (regressionResult.passed ? '✅ ALL BENCHMARK GATES PASSED (Zero Regressions Detected)' : `❌ REGRESSION DETECTED: ${regressionResult.failures.length} gate(s) violated`)
            : '✅ EVALUATION RUN COMPLETE';

        lines.push(`OVERALL STATUS: ${overallStatus}`);
        lines.push(sep);
        lines.push('');

        return lines.join('\n');
    }
}

module.exports = {
    Reporter
};
