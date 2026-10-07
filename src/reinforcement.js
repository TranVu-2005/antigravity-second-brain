// ==============================================================================
// Antigravity Second Brain: Tier 4.5 - Autonomous Tool Reinforcement Engine
// Self-Correction & Error-to-Fix Mining from Trajectory Transcripts
// Automatically remembers failures and promotes winning solutions permanently
// ==============================================================================

const fs = require('node:fs');
const { getSolutionStore } = require('./solutions');

class ReinforcementLearner {
    constructor(solutionStore = getSolutionStore()) {
        this.solutionStore = solutionStore;
    }

    mineTranscript(transcriptPath, projectScope = 'global') {
        if (!transcriptPath || !fs.existsSync(transcriptPath)) return { learned: 0, solutions: [] };
        
        const content = fs.readFileSync(transcriptPath, 'utf8');
        const lines = content.trim().split('\n');
        
        const learnedSolutions = [];
        let state = 'IDLE'; // 'IDLE' | 'FAILURE_DETECTED' | 'REMEDIATION_OBSERVED'
        let pendingFailure = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            let step = null;
            try {
                step = JSON.parse(line);
            } catch (e) {
                continue;
            }

            // 1. Trace Tool Calls
            if (step.type === 'PLANNER_RESPONSE' && Array.isArray(step.tool_calls)) {
                for (const call of step.tool_calls) {
                    if (call.name === 'run_command' && call.args) {
                        let cmd = '';
                        if (typeof call.args.CommandLine === 'string') {
                            cmd = call.args.CommandLine.trim();
                            // strip outer quotes if escaped as JSON string
                            if (cmd.startsWith('"') && cmd.endsWith('"') && cmd.length > 2) {
                                cmd = cmd.slice(1, -1);
                            }
                        }
                        if (state === 'FAILURE_DETECTED' && pendingFailure) {
                            pendingFailure.candidateFix = cmd;
                            state = 'REMEDIATION_OBSERVED';
                        }
                    }
                }
            }

            // 2. Trace Execution Outcomes
            if (step.type === 'GENERIC' && step.content) {
                const text = step.content;

                const hasExitFailure = /exited with code\s+([1-9]\d*)/i.test(text);
                const isExitSuccess = /exited with code\s+0\b/i.test(text) && !hasExitFailure;
                const hasErrorKeywords = /not recognized|cannot be loaded|exception|syntaxerror|unauthorizedaccess|no such column|enoent/i.test(text);

                if (state === 'REMEDIATION_OBSERVED' && pendingFailure && pendingFailure.candidateFix) {
                    if (isExitSuccess) {
                        // VERIFIED SUCCESS! The candidate command actually solved the issue!
                        const id = this.solutionStore.addSolution({
                            error_pattern: pendingFailure.errorSignature,
                            root_cause: pendingFailure.rawOutput,
                            solution_code: `Lệnh khắc phục thành công: ${pendingFailure.candidateFix}`,
                            command_fix: pendingFailure.candidateFix,
                            project_scope: projectScope,
                            tags: 'autonomous_mined,candidate_procedure',
                            confidence: 0.35,
                            trust_level: 'low',
                            verification_status: 'candidate'
                        });

                        learnedSolutions.push({
                            id,
                            error: pendingFailure.errorSignature,
                            fix: pendingFailure.candidateFix
                        });

                        pendingFailure = null;
                        state = 'IDLE';
                    } else if (hasExitFailure) {
                        // The candidate fix failed as well. Update error signature or retry
                        const newError = this._extractErrorSignature(text);
                        if (newError) {
                            pendingFailure.errorSignature = newError;
                            pendingFailure.rawOutput = text.slice(0, 300);
                        }
                        pendingFailure.candidateFix = null;
                        state = 'FAILURE_DETECTED';
                    }
                } else if (hasExitFailure || (hasErrorKeywords && text.includes('exited with code'))) {
                    // Initial failure detected
                    const cleanError = this._extractErrorSignature(text);
                    if (cleanError) {
                        pendingFailure = {
                            errorSignature: cleanError,
                            rawOutput: text.slice(0, 300),
                            candidateFix: null
                        };
                        state = 'FAILURE_DETECTED';
                    }
                }
            }
        }

        return { learned: learnedSolutions.length, solutions: learnedSolutions };
    }

    _extractErrorSignature(output) {
        if (!output || typeof output !== 'string') return null;

        // Strip Antigravity metadata wrappers
        const lines = output.split('\n')
            .map(l => l.trim())
            .filter(l => l && 
                !l.startsWith('Created At:') && 
                !l.startsWith('Completed At:') && 
                !l.startsWith('The command exited with code') &&
                !/^Output:\s*$/i.test(l) &&
                !/^Stdout:\s*$/i.test(l) &&
                !/^Stderr:\s*$/i.test(l)
            );

        if (lines.length === 0) return null;

        for (const line of lines) {
            if (line.includes('is not recognized') || 
                line.includes('cannot be loaded') ||
                line.includes('CommandNotFoundException') ||
                line.includes('SyntaxError') ||
                line.includes('no such column') ||
                line.includes('UnauthorizedAccess') ||
                line.includes('ENOENT') ||
                line.includes('error:') ||
                line.includes('Error:') ||
                line.includes('FAILED') ||
                line.includes('not logged into') ||
                line.includes('Could not find') ||
                line.includes('Argument name was not recognized')) {
                return line.slice(0, 140);
            }
        }
        // Secondary pass: look for lines containing explicit error keywords, strictly ignoring table headers and dividers
        for (const line of lines) {
            if (/^(?:FullName|Name|Mode|Directory:|[-]{3,}|[=]{3,}|\s*$)/i.test(line)) {
                continue;
            }
            if (/error|exception|fail|denied|cannot|invalid|unexpected|fatal|terminated/i.test(line)) {
                return line.slice(0, 140);
            }
        }
        return null;
    }
}

let instance = null;

function getReinforcementLearner(solutionStore = getSolutionStore()) {
    if (!instance) {
        instance = new ReinforcementLearner(solutionStore);
    }
    return instance;
}

module.exports = {
    ReinforcementLearner,
    getReinforcementLearner
};
