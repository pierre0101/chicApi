// /src/websocket/index.js
const WebSocket = require('ws');
const User = require('../models/User');
const ChatRequest = require('../models/ChatRequest');

const clients = new Map();      // Map<userId, ws>
const availableAgents = new Set();

function cleanupClient(userId) {
  clients.delete(userId);
  availableAgents.delete(userId);
}

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const userId = params.get('userId');
    if (!userId) return ws.close(1008, 'No userId');

    // replace any existing socket
    if (clients.has(userId)) {
      try { clients.get(userId).close() } catch {}
      cleanupClient(userId);
    }

    clients.set(userId, ws);
    ws.userId = userId;

    // mark agents as available
    User.findById(userId).then(user => {
      if (user?.role === 'customer-service') {
        availableAgents.add(userId);
      }
    });

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw) } catch { return; }

      // typing
      if (msg.type === 'typing' && msg.to) {
        const dest = clients.get(msg.to);
        if (dest?.readyState === WebSocket.OPEN) {
          dest.send(JSON.stringify({ type: 'typing' }));
        }
      }

      // chat message
      if (msg.type === 'chatMessage' && msg.to && msg.message) {
        const dest = clients.get(msg.to);
        if (dest?.readyState === WebSocket.OPEN) {
          dest.send(JSON.stringify({
            from: ws.userId,
            message: msg.message
          }));
        }
      }
    });

    ws.on('close', () => cleanupClient(userId));
    ws.on('error', () => cleanupClient(userId));
  });

  // ping every 30s
  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.readyState !== WebSocket.OPEN) {
        cleanupClient(ws.userId);
        return ws.terminate();
      }
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));
}

module.exports = { setupWebSocket, clients, availableAgents };
