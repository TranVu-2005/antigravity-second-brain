// ==============================================================================
// Antigravity Second Brain: Canonical Project Identity Resolver
// Deterministic hash-based workspace identity to prevent basename collisions
// ==============================================================================

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/**
 * Normalizes a Git remote URL into a canonical protocol-agnostic identifier.
 * Example: 'git@github.com:User/Repo.git' and 'https://github.com/user/repo' -> 'github.com/user/repo'
 */
function normalizeGitRemote(url) {
    if (!url || typeof url !== 'string') return '';
    let normalized = url.trim().toLowerCase();
    normalized = normalized.replace(/\.git$/i, '');
    normalized = normalized.replace(/^(?:https?:\/\/|ssh:\/\/|git@)/i, '');
    normalized = normalized.replace(/^([^/:]+):/, '$1/');
    normalized = normalized.replace(/\/+/g, '/');
    return normalized;
}

/**
 * Resolves a canonical, collision-free project scope identifier from workspace paths.
 * 
 * Order of Precedence:
 * 1. Git Repository Remote: SHA-256(canonical_remote_url)[0..12] -> 'proj_<hash>' (Dual-boot parity)
 * 2. Explicit Project ID File: .brain/project-id
 * 3. Local Directory Realpath: SHA-256(realpath)[0..12] -> 'local_<hash>'
 * 4. Fallback: 'global'
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

        // 1. Try to resolve via Git Remote
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

                const canonicalRemote = normalizeGitRemote(gitRemote);
                if (canonicalRemote) {
                    const hash = crypto.createHash('sha256').update(canonicalRemote).digest('hex').slice(0, 12);
                    return `proj_${hash}`;
                }

                // Check for .brain/project-id in gitRoot
                const idFile = path.join(gitRoot, '.brain', 'project-id');
                if (fs.existsSync(idFile)) {
                    const customId = fs.readFileSync(idFile, 'utf8').trim();
                    if (customId) return customId;
                }

                // Fallback within git repository without remote
                const normalizedRoot = path.normalize(gitRoot).toLowerCase();
                const hash = crypto.createHash('sha256').update(normalizedRoot).digest('hex').slice(0, 12);
                return `local_${hash}`;
            }
        } catch (gitErr) {}

        // Check for .brain/project-id in primary directory
        const localIdFile = path.join(real, '.brain', 'project-id');
        if (fs.existsSync(localIdFile)) {
            const customId = fs.readFileSync(localIdFile, 'utf8').trim();
            if (customId) return customId;
        }

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
