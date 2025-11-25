const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let messages = []; // store last 100 messages
const MAX_MESSAGES = 100;

console.log(`WebSocket server running on ws://localhost:${PORT}`);

wss.on('connection', ws => {
    console.log('New client connected');

    // Send last 100 messages to new client
    ws.send(JSON.stringify({ type: 'history', messages }));

    // Receive message from client
    ws.on('message', data => {
        try {
            const msg = JSON.parse(data);
            if (!msg.username || !msg.text) return; // ignore invalid
            const message = {
                username: String(msg.username).slice(0, 64),
                text: String(msg.text).slice(0, 1000),
                ts: Date.now()
            };
            messages.push(message);
            if (messages.length > MAX_MESSAGES) messages.shift();

            // Broadcast to all clients
            const packet = JSON.stringify({ type: 'message', message });
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(packet);
                }
            });

            console.log(`Message from ${message.username}: ${message.text}`);
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    ws.on('close', () => console.log('Client disconnected'));
});
