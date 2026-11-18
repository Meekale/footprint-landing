const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

// Read the current local development session when Expo is launched directly.
const tokenFile = path.join(__dirname, '.expo', 'analysis-token');
if (!process.env.EXPO_PUBLIC_SCAN_TOKEN && fs.existsSync(tokenFile)) {
  process.env.EXPO_PUBLIC_SCAN_TOKEN = fs.readFileSync(tokenFile, 'utf8').trim();
}
const config = getDefaultConfig(__dirname);
const previous = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = previous ? previous(middleware, server) : middleware;
  return (req, res, nextHandler) => {
    const route = req.url?.split('?')[0];
    if (!route?.startsWith('/bodyfat-api/')) return next(req, res, nextHandler);
    const allowed = {
      '/bodyfat-api/health': 'GET',
      '/bodyfat-api/analyze': 'POST',
      '/bodyfat-api/estimate': 'POST',
      '/bodyfat-api/torso': 'POST',
    };
    if (allowed[route] !== req.method) {
      res.writeHead(404); return res.end();
    }
    const headers = { ...req.headers, host: '127.0.0.1:8765' };
    delete headers.connection;
    const upstream = http.request({
      hostname: '127.0.0.1', port: 8765,
      path: route.slice('/bodyfat-api'.length), method: req.method, headers,
    }, response => {
      res.writeHead(response.statusCode, { ...response.headers, 'cache-control': 'no-store' });
      response.pipe(res);
    });
    upstream.setTimeout(60000, () => upstream.destroy(new Error('Analysis timed out')));
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Analysis service unavailable. Restart with npm start or npm run start:tunnel.' }));
      } else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  };
};
module.exports = config;
