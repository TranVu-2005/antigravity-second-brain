// ==============================================================================
// Antigravity Second Brain: Cross-Process Git Sync Lock
// Atomic file-based mutex to prevent concurrent git pull/push race conditions
// ==============================================================================

const fs = require('node:fs');
const path = require('node:path');

const STALE_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes stale timeout

class GitSyncLock {
    /**
     * @param {string} lockFilePath Absolute or relative path to the lock file
     */
    constructor(lockFilePath) {
        this.lockFile = path.resolve(lockFilePath);
        this.fd = null;
    }

    /**
     * Acquires the lock exclusively.
     * @param {number} timeoutMs Max time in milliseconds to wait for lock acquisition
     * @returns {boolean} true if lock was acquired, false if timed out
     */
    acquire(timeoutMs = 15000) {
        const start = Date.now();
        const pollIntervalMs = 100;

        while (Date.now() - start < timeoutMs) {
            try {
                // 'wx' flag: Open for writing. The file is created (if it does not exist)
                // or fails (if it exists) atomically across all POSIX and Windows platforms.
                this.fd = fs.openSync(this.lockFile, 'wx');
                const lockData = JSON.stringify({
                    pid: process.pid,
                    timestamp: Date.now(),
                    acquired_at: new Date().toISOString()
                });
                fs.writeSync(this.fd, lockData);
                return true;
            } catch (err) {
                if (err.code === 'EEXIST') {
                    // Check if lock file is stale (> 10 minutes old)
                    try {
                        const stat = fs.statSync(this.lockFile);
                        if (Date.now() - stat.mtimeMs > STALE_LOCK_TIMEOUT_MS) {
                            try {
                                fs.unlinkSync(this.lockFile);
                                continue; // Stale lock cleared, retry immediately
                            } catch (uErr) {}
                        }
                    } catch (sErr) {}

                    // Sleep for pollIntervalMs
                    const sleepUntil = Date.now() + pollIntervalMs;
                    while (Date.now() < sleepUntil) {
                        // Busy-wait briefly for sub-second synchronization
                    }
                } else {
                    return false;
                }
            }
        }

        return false;
    }

    /**
     * Releases the acquired lock cleanly.
     */
    release() {
        if (this.fd !== null) {
            try {
                fs.closeSync(this.fd);
            } catch (e) {}
            this.fd = null;
        }

        try {
            if (fs.existsSync(this.lockFile)) {
                fs.unlinkSync(this.lockFile);
            }
        } catch (e) {}
    }
}

module.exports = {
    GitSyncLock,
    STALE_LOCK_TIMEOUT_MS
};
