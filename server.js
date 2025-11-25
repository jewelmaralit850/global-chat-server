const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const messages = [];
let nextId = 1;
const MAX_MESSAGES = 5000;

function addMessage(username, text) {
  const msg = {
    id: nextId++,
    ts: Date.now(),
    username: String(username).slice(0, 64),
    text: String(text).slice(0, 1000)
  };
  messages.push(msg);
  if (messages.length > MAX_MESSAGES) messages.shift();

  const packet = JSON.stringify({ type: 'message', message: msg });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(packet);
  });

  return msg;
}

app.post('/send', (req, res) => {
  try {
    const { username, text } = req.body || {};
    if (!username || !text) {
    return res.status(400).json({ ok: false, err: "username & text required" });
    }
    const msg = addMessage(username, text);
    return res.json({ ok: true, message: msg });
  } catch (e) {
    return res.status(500).json({ ok: false, err: "server error" });
  }
});

app.get('/messages', (req, res) => {
  const since = parseInt(req.query.since || "0");
  const result = messages.filter(m => m.ts > since);
  return res.json({ ok: true, messages: result });
});

wss.on('connection', ws => {
  ws.send(JSON.stringify({
    type: 'history',
    messages: messages.slice(-100)
  }));

  ws.on('message', raw => {
    try {
      const obj = JSON.parse(raw.toString());
      if (obj.username && obj.text) addMessage(obj.username, obj.text);
    } catch {}
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
