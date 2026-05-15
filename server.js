const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'pulse/ proxy running' });
});

// ── Oura proxy ──
app.get('/oura/:endpoint', async (req, res) => {
  const token = req.headers['x-oura-token'];
  if (!token) return res.status(401).json({ error: 'Missing x-oura-token header' });

  const endpoint = req.params.endpoint;
  const query = new URLSearchParams(req.query).toString();
  const url = `https://api.ouraring.com/v2/usercollection/${endpoint}${query ? '?' + query : ''}`;

  try {
    const ouraRes = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (ouraRes.status === 401) return res.status(401).json({ error: 'Invalid Oura token' });
    if (ouraRes.status === 403) return res.status(403).json({ error: 'Oura token expired' });
    if (!ouraRes.ok) return res.status(ouraRes.status).json({ error: `Oura API error ${ouraRes.status}` });
    res.json(await ouraRes.json());
  } catch (err) {
    res.status(500).json({ error: 'Proxy fetch failed: ' + err.message });
  }
});

// ── Claude proxy ──
// Browser calls this instead of Anthropic directly — key never leaves the server
app.post('/claude', async (req, res) => {
  const claudeKey = process.env.CLAUDE_API_KEY;
  if (!claudeKey) return res.status(500).json({ error: 'CLAUDE_API_KEY not set on server' });

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await claudeRes.json();
    res.status(claudeRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Claude proxy failed: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`pulse/ proxy running on port ${PORT}`);
});
