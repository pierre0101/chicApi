// src/websocket.js
const WebSocket = require('ws');
const url = require('url');

const agents = new Map();      // agentId => ws
const guests = new Map();      // guestId => ws
const pendingChats = new Map(); // guestId => { userName, contactInfo, acceptedBy: agentId|null }

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const { userId, role, userName, contactInfo } = url.parse(req.url, true).query;

    // --- AGENT CONNECTION ---
    if (role === 'customer-service' && userId) {
      agents.set(userId, ws);
      console.log(`[WS] Agent connected: ${userId} (${userName})`);

      // Send current pending chats
      for (const [guestId, info] of pendingChats.entries()) {
        if (!info.acceptedBy) {
          ws.send(JSON.stringify({
            type: 'chatRequest',
            guest: { guestId, userName: info.userName, contactInfo: info.contactInfo }
          }));
        }
      }

      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        // --- Accept chat request ---
        if (msg.type === 'acceptChat' && msg.guestId && guests.has(msg.guestId)) {
          // Only allow one agent per guest
          if (!pendingChats.get(msg.guestId)?.acceptedBy) {
            pendingChats.get(msg.guestId).acceptedBy = userId;
            // Notify guest
            guests.get(msg.guestId).send(JSON.stringify({
              type: 'chatRequestAccepted',
              agentId: userId,
              agentName: userName,
            }));
            // Optionally, remove this chatRequest from other agents' UIs by sending an "removeChatRequest" message
          }
        }

        // --- Chat messages ---
        if (msg.type === 'chatMessage' && msg.to && guests.has(msg.to)) {
          guests.get(msg.to).send(JSON.stringify({
            type: 'chatMessage',
            from: userName,
            text: msg.text,
          }));
        }
      });

      ws.on('close', () => agents.delete(userId));

    // --- GUEST CONNECTION ---
    } else if (userId && userName) {
      guests.set(userId, ws);
      pendingChats.set(userId, { userName, contactInfo, acceptedBy: null });

      // Notify all connected agents
      for (const wsAgent of agents.values()) {
        wsAgent.send(JSON.stringify({
          type: 'chatRequest',
          guest: { guestId: userId, userName, contactInfo }
        }));
      }

      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        // Only relay to agent if chat is accepted
        if (msg.type === 'chatMessage') {
          const chat = pendingChats.get(userId);
          if (chat && chat.acceptedBy && agents.has(chat.acceptedBy)) {
            agents.get(chat.acceptedBy).send(JSON.stringify({
              type: 'chatMessage',
              from: userName,
              text: msg.text,
            }));
          }
        }
      });

      ws.on('close', () => {
        guests.delete(userId);
        pendingChats.delete(userId);
      });
    }
  });
}

module.exports = { setupWebSocket };
