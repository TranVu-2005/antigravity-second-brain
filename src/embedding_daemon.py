#!/usr/bin/env python3
# ==============================================================================
# Antigravity Second Brain: Dedicated Local Embedding Micro-Daemon
# Production-grade, zero-leak HTTP microservice hosting Multilingual Transformer
# ==============================================================================

import os
import sys
import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
DEFAULT_PORT = 49152
DEFAULT_HOST = "127.0.0.1"

# Global model instance
model = None
START_TIME = time.time()

def load_model():
    global model
    if model is not None:
        return model
    
    from fastembed import TextEmbedding
    model = TextEmbedding(model_name=MODEL_NAME)
    return model

class EmbeddingHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Silence standard HTTP access logging to keep terminal completely clean
        return

    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        if self.path == '/health' or self.path == '/':
            resp = {
                "status": "ready",
                "model": MODEL_NAME,
                "dimension": 384,
                "pid": os.getpid(),
                "uptime": time.time() - START_TIME
            }
            body = json.dumps(resp).encode('utf-8')
            self._set_headers(200)
            self.wfile.write(body)
        else:
            self._set_headers(404)
            self.wfile.write(b'{"error": "Not Found"}')

    def do_POST(self):
        if self.path == '/embed':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length <= 0:
                self._set_headers(400)
                self.wfile.write(b'{"error": "Empty body"}')
                return

            try:
                raw_data = self.rfile.read(content_length)
                payload = json.loads(raw_data.decode('utf-8'))
                
                texts = payload.get('texts', [])
                if isinstance(texts, str):
                    texts = [texts]
                
                if not texts:
                    self._set_headers(200)
                    self.wfile.write(b'{"embeddings": []}')
                    return

                mdl = load_model()
                results = list(mdl.embed(texts))
                embeddings = [vec.tolist() for vec in results]

                resp = {
                    "embeddings": embeddings,
                    "dimension": len(embeddings[0]) if embeddings else 384,
                    "count": len(embeddings)
                }
                body = json.dumps(resp).encode('utf-8')
                self._set_headers(200)
                self.wfile.write(body)
            except Exception as e:
                self._set_headers(500)
                err_resp = json.dumps({"error": str(e)}).encode('utf-8')
                self.wfile.write(err_resp)
        else:
            self._set_headers(404)
            self.wfile.write(b'{"error": "Not Found"}')

def is_already_running(port=DEFAULT_PORT):
    try:
        req = urllib.request.Request(f"http://{DEFAULT_HOST}:{port}/health")
        with urllib.request.urlopen(req, timeout=1.0) as response:
            if response.status == 200:
                return True
    except Exception:
        pass
    return False

def main():
    global START_TIME
    START_TIME = time.time()
    
    port = DEFAULT_PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])

    if is_already_running(port):
        print(f"[SecondBrain Embedding Daemon] Already active on {DEFAULT_HOST}:{port}. Exiting.", flush=True)
        sys.exit(0)

    print(f"[SecondBrain Embedding Daemon] Pre-warming {MODEL_NAME}...", flush=True)
    load_model()
    print(f"[SecondBrain Embedding Daemon] Model ready! Starting HTTP server on {DEFAULT_HOST}:{port}...", flush=True)

    server = HTTPServer((DEFAULT_HOST, port), EmbeddingHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[SecondBrain Embedding Daemon] Stopping gracefully...", flush=True)
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
