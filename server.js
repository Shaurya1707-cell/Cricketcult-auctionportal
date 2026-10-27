/**
 * CricketCult Auction Portal - Real-Time Multi-Device Sync Server
 * Zero external dependencies (Pure Node.js built-ins: http, fs, path, os, url).
 *
 * Provides:
 * 1. High-performance static web server
 * 2. Real-Time Server-Sent Events (SSE) synchronization across all phones and PCs
 * 3. Automatic Wi-Fi LAN IP detection so phones can connect via Wi-Fi instantly
 * 4. Room state persistence (data/room_state_<room>.json)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const STORAGE_DIR = path.join(__dirname, 'data', 'rooms');

// Ensure room storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create storage directory:', e);
  }
}

// In-memory room state and SSE client subscribers: { [roomId]: Set<http.ServerResponse> }
const roomClients = new Map();
const roomStates = new Map();

// MIME Types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Find local network IP
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// Load persisted room state
function getRoomState(roomId) {
  if (roomStates.has(roomId)) {
    return roomStates.get(roomId);
  }
  const filePath = path.join(STORAGE_DIR, `room_${sanitizeRoomId(roomId)}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      roomStates.set(roomId, data);
      return data;
    } catch (e) {
      console.warn(`Error reading room file for ${roomId}:`, e);
    }
  }
  return null;
}

// Save room state to memory and disk
function saveRoomState(roomId, state) {
  roomStates.set(roomId, state);
  const filePath = path.join(STORAGE_DIR, `room_${sanitizeRoomId(roomId)}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.warn(`Failed to save room file for ${roomId}:`, e);
  }
}

function sanitizeRoomId(roomId) {
  return String(roomId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Broadcast SSE event to all connected devices in a room
function broadcastToRoom(roomId, eventName, payload, excludeClient = null) {
  const clients = roomClients.get(roomId);
  if (!clients || clients.size === 0) return;

  const dataStr = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    if (client !== excludeClient && !client.writableEnded) {
      try {
        client.write(dataStr);
      } catch (err) {
        console.warn('Error writing to client:', err);
      }
    }
  }
}

// Parse request JSON body helper
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Set standard CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = reqUrl.pathname;
  const getQuery = (k) => reqUrl.searchParams.get(k);

  // --- API: Health & Local IP Status ---
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const localIps = getLocalIpAddresses();
    res.end(JSON.stringify({
      status: 'ok',
      version: '2.1.0',
      serverTime: Date.now(),
      localIps,
      port: PORT,
      primaryIp: localIps[0] || 'localhost',
      phoneUrl: localIps.length > 0 ? `http://${localIps[0]}:${PORT}` : `http://localhost:${PORT}`
    }));
    return;
  }

  // --- API: Get Room State ---
  if (pathname === '/api/state' && req.method === 'GET') {
    const roomId = getQuery('room') || 'default';
    const state = getRoomState(roomId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      room: roomId,
      exists: !!state,
      state: state
    }));
    return;
  }

  // --- API: Save & Broadcast Room State ---
  if (pathname === '/api/state' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const roomId = body.room || getQuery('room') || 'default';
      const state = body.state;
      const deviceId = body.deviceId || 'unknown';

      if (!state) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing state payload' }));
        return;
      }

      saveRoomState(roomId, state);

      // Broadcast full state update to other devices in this room
      broadcastToRoom(roomId, 'sync_state', {
        room: roomId,
        state: state,
        fromDeviceId: deviceId,
        timestamp: Date.now()
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: High-Speed Action Broadcast (Bid, Podium, Timer, Sold) ---
  if (pathname === '/api/action' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const roomId = body.room || 'default';
      const action = body.action;
      const payload = body.payload;
      const deviceId = body.deviceId || 'unknown';

      if (!action) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing action' }));
        return;
      }

      // If full state was included with action, save it
      if (body.state) {
        saveRoomState(roomId, body.state);
      }

      // Broadcast action to all connected devices in the room
      broadcastToRoom(roomId, 'sync_action', {
        room: roomId,
        action,
        payload,
        state: body.state || null,
        fromDeviceId: deviceId,
        timestamp: Date.now()
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // --- API: Server-Sent Events (SSE) Real-Time Subscription ---
  if (pathname === '/api/events') {
    const roomId = getQuery('room') || 'default';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    if (!roomClients.has(roomId)) {
      roomClients.set(roomId, new Set());
    }
    const clients = roomClients.get(roomId);
    clients.add(res);

    // Send initial connected acknowledgement with server state
    const currentState = getRoomState(roomId);
    res.write(`event: connected\ndata: ${JSON.stringify({
      room: roomId,
      connectedClients: clients.size,
      hasServerState: !!currentState,
      state: currentState,
      serverTime: Date.now()
    })}\n\n`);

    // Notify room of new device joined
    broadcastToRoom(roomId, 'device_count', {
      room: roomId,
      count: clients.size
    });

    // Periodic heartbeat to prevent mobile browser connection drops
    const heartbeatTimer = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      clients.delete(res);
      broadcastToRoom(roomId, 'device_count', {
        room: roomId,
        count: clients.size
      });
    });
    return;
  }

  // --- Static File Serving ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  // Security check: ensure path is within PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for single-page routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, content) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log('\n🏏 ========================================================');
  console.log('   CRICKETCULT LIVE AUCTION - MULTI-DEVICE SYNC SERVER');
  console.log('========================================================');
  console.log(`💻 PC / Auctioneer:    http://localhost:${PORT}`);
  if (localIps.length > 0) {
    localIps.forEach(ip => {
      console.log(`📱 Phone / Local Wi-Fi: http://${ip}:${PORT}`);
    });
  } else {
    console.log(`📱 Phone: Connect on same Wi-Fi using your PC's IP address:${PORT}`);
  }
  console.log('--------------------------------------------------------');
  console.log('✨ All devices opened on this link will stay in 100% sync!');
  console.log('   Bids, Podium, Timers & Squads update in real time!');
  console.log('========================================================\n');
});
