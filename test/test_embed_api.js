const { performance } = require('node:perf_hooks');

function cosine(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function test() {
    try {
        const res = await fetch('http://127.0.0.1:49152/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                texts: [
                    'quanh nhà có gì ăn ngon',
                    'Khu vực sinh sống và ăn uống tại Hoàng Mai, Hà Nội',
                    'Cấu hình card màn hình NVIDIA RTX 4050'
                ]
            })
        });
        const { embeddings } = await res.json();
        console.log('Cosine (Ăn ngon <-> Hoàng Mai Hà Nội):', cosine(embeddings[0], embeddings[1]).toFixed(4));
        console.log('Cosine (Ăn ngon <-> Card RTX 4050)   :', cosine(embeddings[0], embeddings[2]).toFixed(4));
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

test();
