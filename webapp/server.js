const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = 8080;

// Service endpoints (Docker network names)
const SERVICES = {
  'otel-collector': { host: 'otel-collector', port: 8889, path: '/metrics', name: 'OTEL Collector' },
  'victoriametrics': { host: 'victoriametrics', port: 8428, path: '/health', name: 'VictoriaMetrics' },
  'victorialogs': { host: 'victorialogs', port: 9428, path: '/health', name: 'VictoriaLogs' },
  'grafana': { host: 'grafana', port: 3000, path: '/api/health', name: 'Grafana' },
  'postgres': { host: 'postgres', port: 5432, path: null, name: 'PostgreSQL' },
};

// --- Helper: HTTP GET with timeout ---
function httpGet(host, port, reqPath, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path: reqPath, timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

// --- Helper: TCP check (for postgres) ---
function tcpCheck(host, port, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
    socket.on('error', reject);
    socket.connect(port, host);
  });
}

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// Content served from mounted volumes
app.use('/content', express.static('/data/content'));

// --- API: Health check all services ---
app.get('/api/health', async (req, res) => {
  const results = {};
  for (const [id, svc] of Object.entries(SERVICES)) {
    try {
      if (id === 'postgres') {
        await tcpCheck(svc.host, svc.port);
        results[id] = { name: svc.name, status: 'ok' };
      } else {
        const resp = await httpGet(svc.host, svc.port, svc.path);
        results[id] = { name: svc.name, status: resp.status === 200 ? 'ok' : 'error', code: resp.status };
      }
    } catch (err) {
      results[id] = { name: svc.name, status: 'error', error: err.message };
    }
  }
  res.json(results);
});

// --- API: Check if PG metrics are being collected ---
app.get('/api/metrics/check', async (req, res) => {
  try {
    const resp = await httpGet('otel-collector', 8889, '/metrics');
    const lines = resp.data.split('\n').filter(l => l.startsWith('postgresql_'));
    res.json({ ok: true, count: lines.length, sample: lines.slice(0, 5) });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// --- API: Query VictoriaMetrics ---
app.get('/api/metrics/query', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query parameter q' });
  try {
    const resp = await httpGet('victoriametrics', 8428, `/api/v1/query?query=${encodeURIComponent(query)}`);
    res.setHeader('Content-Type', 'application/json');
    res.send(resp.data);
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
});

// --- API: Query VictoriaLogs ---
app.get('/api/logs/query', async (req, res) => {
  const query = req.query.q || '*';
  const limit = req.query.limit || '10';
  try {
    const resp = await httpGet('victorialogs', 9428,
      `/select/logsql/query?query=${encodeURIComponent(query)}&limit=${limit}`);
    // VictoriaLogs returns NDJSON, parse into array
    const logs = resp.data.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return { raw: line }; }
    });
    res.json({ ok: true, count: logs.length, logs });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// --- API: List available detailed content files ---
app.get('/api/content/detailed', async (req, res) => {
  const slidesDir = '/data/content/slides';
  try {
    const files = fs.readdirSync(slidesDir);
    const detailed = files.filter(f => f.endsWith('.detailed.md')).map(f => f.replace('.detailed.md', ''));
    res.json({ available: detailed });
  } catch (err) {
    res.json({ available: [] });
  }
});

// --- SPA fallback ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Workshop webapp running on port ${PORT}`);
});
