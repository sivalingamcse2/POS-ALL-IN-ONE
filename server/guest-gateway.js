const express = require('express');
const path = require('path');

const app = express();
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
const backendUrl = process.env.POS_BACKEND_URL || 'http://127.0.0.1:5000';
const orderWindows = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.use('/api', async (req, res) => {
  const pathname = req.originalUrl.split('?')[0];
  const allowed = (
    req.method === 'GET' && [
      '/api/public/tables',
      '/api/menu/items',
      '/api/menu/categories'
    ].includes(pathname)
  ) || (
    req.method === 'POST' && pathname === '/api/public/orders/new'
  );

  if (!allowed) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method === 'POST') {
    const clientAddress = req.get('cf-connecting-ip') || req.ip;
    const now = Date.now();
    const windowStart = now - 10 * 60 * 1000;
    const requests = (orderWindows.get(clientAddress) || []).filter(time => time > windowStart);
    if (requests.length >= 20) {
      return res.status(429).json({ error: 'Too many order attempts. Please try again shortly.' });
    }
    requests.push(now);
    orderWindows.set(clientAddress, requests);
  }

  try {
    const headers = {};
    const restaurantId = req.get('x-restaurant-id');
    if (restaurantId && /^\d+$/.test(restaurantId)) {
      headers['x-restaurant-id'] = restaurantId;
    }
    if (req.method === 'POST') headers['content-type'] = 'application/json';

    const upstream = await fetch(`${backendUrl}${req.originalUrl}`, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
    res.status(upstream.status);
    res.type(upstream.headers.get('content-type') || 'application/json');
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error('[Guest Gateway] Backend request failed:', error.message);
    return res.status(502).json({ error: 'Guest ordering is temporarily unavailable.' });
  }
});

app.use('/assets', express.static(path.join(clientDist, 'assets'), {
  dotfiles: 'deny',
  fallthrough: false,
  immutable: true,
  maxAge: '1y'
}));

app.get(/^\/order\/\d+\/?$/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((req, res) => res.status(404).send('Guest ordering page not found.'));

const port = Number(process.env.GUEST_GATEWAY_PORT || 5055);
app.listen(port, '127.0.0.1', () => {
  console.log(`[Guest Gateway] Listening on http://127.0.0.1:${port}`);
  console.log('[Guest Gateway] Only guest menu assets and order APIs are exposed.');
});
