const { spawnSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');

const hookPath = path.join(__dirname, '..', 'hooks', 'pre_invocation.js');
const payload = JSON.stringify({
    conversationId: '1372fd0a-fb71-4e55-ab51-5f182f6d5a1f',
    transcriptPath: path.join(__dirname, 'fixtures', 'mock_transcript.jsonl')
});

// Use process.execPath without shell: true to avoid DEP0190 and ensure cross-platform parity
const result = spawnSync(process.execPath, [hookPath], {
    input: payload,
    encoding: 'utf8',
    shell: false
});

console.log('Hook Exit Code:', result.status);
if (result.stderr) console.log('Hook Stderr:', result.stderr);

assert.strictEqual(result.status, 0, 'Hook process should exit with 0');
assert.ok(result.stdout && result.stdout.trim().length > 0, 'Hook should produce stdout output');

const parsed = JSON.parse(result.stdout);
assert.ok(parsed, 'Output must be valid JSON');
if (parsed.injectSteps && parsed.injectSteps.length > 0) {
    console.log('Ephemeral message preview:\n', parsed.injectSteps[0].ephemeralMessage.slice(0, 150));
}
console.log('✔ test_hook.js passed successfully!');
