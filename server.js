const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MSG_FILE = path.join(__dirname, 'messages.json');

// Load saved messages or start empty
let messages = [];
try {
  if (fs.existsSync(MSG_FILE)) {
    messages = JSON.parse(fs.readFileSync(MSG_FILE, 'utf8'));
  }
} catch (e) {
  console.error("Failed to load messages.json:", e);
}

let nextId = messages.length ? messages[messages.length - 1].id + 1 : 1;
const MAX_MESSAGES = 5000;

// Save messages to file
function saveMessages() {
  try {
    fs.writeFileSync(MSG_FILE, JSON.stringify(messages, null, 2));
  } catch (e) {
    console.error("Failed to save messages:", e);
  }
}

// Add a new message
function addMessage(username, text) {
  if (!text) return null; // ignore empty
  const msg = {
    id: nextId++,
    ts: Date.now(),
    username: String(username).slice(0, 64),
    text: String(text).slice(0, 1000)
  };
  messages.push(msg);
  if (messages.length > MAX_MESSAGES) messages.shift();
  saveMessages();

  const packet = JSON.stringify({ type: 'message', message: msg });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(packet);
  });

  return msg;
}

// Homepage
app.get('/', (req, res) => {
  let html = '<h1>Global Chat Server</h1>';
  html += '<p>Send POST to /send and GET /messages to view messages.</p>';
  html += '<pre>' + JSON.stringify(messages, null, 2) + '</pre>';
  res.send(html);
});

// Get messages
app.get('/messages', (req, res) => {
  const since = parseInt(req.query.since || "0");
  const result = messages.filter(m => m.ts > since);
  res.json({ ok: true, messages: result });
});

// Send messages
app.post('/send', (req, res) => {
  const { username, text, message } = req.body || {};
  const content = text || message; // accept either field
  if (!username || !content) {
    return res.status(400).json({ ok: false, err: "username & text/message required" });
  }
  const msg = addMessage(username, content);
  res.json({ ok: true, message: msg });
});

// WebSocket connection
wss.on('connection', ws => {
  // send last 100 messages on connect
  ws.send(JSON.stringify({ type: 'history', messages: messages.slice(-100) }));

  ws.on('message', raw => {
    try {
      const obj = JSON.parse(raw.toString());
      const content = obj.text || obj.message;
      if (obj.username && content) addMessage(obj.username, content);
    } catch (e) {}
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
