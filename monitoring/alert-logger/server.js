'use strict';

// Minimal on-call receiver: Alertmanager posts here, we log each notification and
// expose the history at GET /alerts so the pipeline can verify delivery.
const http = require('http');

const received = [];

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        received.push({ receivedAt: new Date().toISOString(), ...payload });
        if (received.length > 100) received.shift();
        for (const a of payload.alerts || []) {
          console.log(`[${payload.status.toUpperCase()}] ${a.labels.alertname} severity=${a.labels.severity} - ${a.annotations.summary}`);
        }
      } catch (err) {
        console.error('bad payload', err.message);
      }
      res.writeHead(200).end('ok');
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/alerts') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(received));
    return;
  }
  res.writeHead(404).end();
}).listen(5001, () => console.log('alert-logger listening on 5001'));
