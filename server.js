const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow requests from any origin (your local HTML file, or wherever pulse/ is hosted)
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Health check ──
app.get('/', (req, res) => {
  res.json({ status: 'pulse/ proxy running' });
});

// ── Oura proxy ──
// Forwards any Oura v2 API call, injecting the token server-side
// Usage: GET /oura/daily_readiness?start_date=2026-01-01&end_date=2026-05-15
//        Header: x-oura-token: your_token_here
app.get('/oura/:endpoint', async (req, res) => {
  const token = req.headers['x-oura-token'];
  if (!token) {
    return res.status(401).json({ error: 'Missing x-oura-token header' });
  }

  const endpoint = req.params.endpoint;
  const query = new URLSearchParams(req.query).toString();
  const url = `https://api.ouraring.com/v2/usercollection/${endpoint}${query ? '?' + query : ''}`;

  try {
    const ouraRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (ouraRes.status === 401) return res.status(401).json({ error: 'Invalid Oura token' });
    if (ouraRes.status === 403) return res.status(403).json({ error: 'Oura token expired or insufficient scope' });
    if (!ouraRes.ok) return res.status(ouraRes.status).json({ error: `Oura API error ${ouraRes.status}` });

    const data = await ouraRes.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Proxy fetch failed: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`pulse/ proxy running on port ${PORT}`);
});
