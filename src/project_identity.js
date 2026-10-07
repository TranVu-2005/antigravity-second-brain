// ==============================================================================
// Antigravity Second Brain: Canonical Project Identity Resolver
// Deterministic hash-based workspace identity to prevent basename collisions
// ==============================================================================

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/**
 * Resolves a canonical, collision-free project scope identifier from workspace paths.
 * 
 * Order of Precedence:
 * 1. Git Repository: SHA-256(git_remote_url + ':' + git_root_path)[0..12] -> 'proj_<hash>'
 * 2. Local Directory: SHA-256(realpath)[0..12] -> 'local_<hash>'
 * 3. Fallback: 'global'
 * 
 * @param {string[]|string} workspacePaths
 * @returns {string} canonical scope identifier
 */
function resolveCanonicalProjectScope(workspacePaths) {
    if (!workspacePaths) return 'global';
    
    let primary = null;
    if (Array.isArray(workspacePaths)) {
        if (workspacePaths.length === 0) return 'global';
        primary = workspacePaths[0];
    } else if (typeof workspacePaths === 'string') {
        primary = workspacePaths;
    }

    if (!primary || typeof primary !== 'string') return 'global';

    try {
        let real = primary;
        try {
            real = fs.realpathSync(primary);
        } catch (e) {
            real = path.resolve(primary);
        }

        // 1. Try to resolve via Git Remote & Root
        try {
            const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
                cwd: real,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
                timeout: 1000
            }).trim();

            if (gitRoot) {
                let gitRemote = '';
                try {
                    gitRemote = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
                        cwd: gitRoot,
                        encoding: 'utf8',
                        stdio: ['ignore', 'pipe', 'ignore'],
                        timeout: 1000
                    }).trim();
                } catch (rErr) {}

                const seed = gitRemote ? `${gitRemote.toLowerCase()}:${path.normalize(gitRoot).toLowerCase()}` : path.normalize(gitRoot).toLowerCase();
                const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
                return `proj_${hash}`;
            }
        } catch (gitErr) {}

        // 2. Fallback: Local directory realpath hash
        const normalized = path.normalize(real).toLowerCase();
        const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
        return `local_${hash}`;
    } catch (err) {
        return 'global';
    }
}

/**
 * Returns detailed identity object with canonical ID and human-friendly alias
 */
function getProjectIdentity(workspacePaths) {
    const scopeId = resolveCanonicalProjectScope(workspacePaths);
    let alias = 'global';
    if (Array.isArray(workspacePaths) && workspacePaths[0]) {
        alias = path.basename(workspacePaths[0]);
    } else if (typeof workspacePaths === 'string') {
        alias = path.basename(workspacePaths);
    }
    return {
        id: scopeId,
        alias,
        isGlobal: scopeId === 'global'
    };
}

module.exports = {
    resolveCanonicalProjectScope,
    getProjectIdentity
};
