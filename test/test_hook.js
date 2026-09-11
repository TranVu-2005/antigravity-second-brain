const { spawnSync } = require('child_process');
const path = require('path');

const hookPath = path.join(__dirname, '..', 'hooks', 'pre_invocation.js');
const payload = JSON.stringify({
    conversationId: '1372fd0a-fb71-4e55-ab51-5f182f6d5a1f',
    transcriptPath: 'C:/Users/tvu16/.gemini/antigravity/brain/1372fd0a-fb71-4e55-ab51-5f182f6d5a1f/.system_generated/logs/transcript.jsonl'
});

const result = spawnSync('agy-node', [hookPath], {
    input: payload,
    encoding: 'utf8',
    shell: true
});

console.log('Hook Exit Code:', result.status);
console.log('Hook Output (stdout):', result.stdout);
if (result.stderr) console.log('Hook Stderr:', result.stderr);

try {
    const parsed = JSON.parse(result.stdout);
    console.log('Parsed successfully!');
    if (parsed.injectSteps && parsed.injectSteps.length > 0) {
        console.log('Ephemeral message preview:\n', parsed.injectSteps[0].ephemeralMessage.slice(0, 300));
    }
} catch (e) {
    console.error('Failed to parse output as JSON:', e);
}
