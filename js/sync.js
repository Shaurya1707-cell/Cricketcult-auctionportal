/**
 * CricketCult Real-Time Multi-Device Synchronization Engine
 * Seamlessly connects PCs, Laptops, and Mobile Phones across:
 * 1. Local Wi-Fi (Node.js Server-Sent Events / HTTP API)
 * 2. Cloud WebRTC (PeerJS Cloud Relay - for GitHub Pages / remote networks)
 * 3. Browser BroadcastChannel (Same-device multi-window)
 */
window.AuctionSync = (function () {
  'use strict';

  // Device unique fingerprint
  let deviceId = localStorage.getItem('auction_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('auction_device_id', deviceId);
  }

  // Active Room ID from URL or storage
  let currentRoom = getInitialRoom();
  let syncMode = 'offline'; // 'local_server' | 'cloud_p2p' | 'offline'
  let connectedDeviceCount = 1;
  let isHost = false;

  // Local Server connection objects
  let eventSource = null;
  let serverInfo = null;

  // PeerJS WebRTC connection objects
  let peer = null;
  let peerConnections = new Map();
  let hostConnection = null;

  // BroadcastChannel for same-machine tabs
  let broadcastChannel = null;

  function getInitialRoom() {
    try {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('room');
      if (r && r.trim()) return r.trim().toUpperCase();
    } catch (e) {}
    return localStorage.getItem('auction_room_id') || 'CULT26';
  }

  function setRoom(newRoom) {
    const clean = String(newRoom || 'CULT26').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!clean || clean === currentRoom) return;

    currentRoom = clean;
    localStorage.setItem('auction_room_id', currentRoom);

    // Update URL query param without refreshing
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('room', currentRoom);
      window.history.replaceState(null, '', u.toString());
    } catch (e) {}

    // Reconnect transports
    disconnectAll();
    connect();
    updateUI();
  }

  function init() {
    setupBroadcastChannel();
    connect();
    setupSyncUI();
  }

  // --- Same-Device Multi-Tab Channel ---
  function setupBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        if (broadcastChannel) broadcastChannel.close();
        broadcastChannel = new BroadcastChannel('cricketcult_sync_' + currentRoom);
        broadcastChannel.onmessage = (event) => {
          const msg = event.data;
          if (!msg || msg.fromDeviceId === deviceId) return;

          if (msg.type === 'STATE_UPDATE') {
            handleRemoteState(msg.state, msg.fromDeviceId);
          } else if (msg.type === 'ACTION') {
            handleRemoteAction(msg.action, msg.payload, msg.state, msg.fromDeviceId);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }
  }

  // --- Connect to Transports (Local Server first, fallback to PeerJS Cloud) ---
  async function connect() {
    updateIndicator('connecting', 'Connecting...');

    // 1. Check if running on or connected to our local Node sync server
    const hasLocalServer = await checkLocalServer();
    if (hasLocalServer) {
      connectLocalServer();
      return;
    }

    // 2. Fallback: Initialize WebRTC Peer-to-Peer Cloud Relay (PeerJS)
    connectPeerCloud();
  }

  function disconnectAll() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    peerConnections.clear();
    hostConnection = null;
  }

  // Check if server.js is responding on this origin or localhost:3000
  async function checkLocalServer() {
    const originsToTest = [
      window.location.origin,
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

    for (const testOrigin of originsToTest) {
      if (testOrigin.startsWith('file:')) continue;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(`${testOrigin}/api/status`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          serverInfo = await res.json();
          serverInfo.apiOrigin = testOrigin;
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  // Connect via Server-Sent Events (SSE) to server.js
  function connectLocalServer() {
    syncMode = 'local_server';
    const origin = serverInfo.apiOrigin;

    // Fetch latest room state on initial connection
    fetch(`${origin}/api/state?room=${encodeURIComponent(currentRoom)}`)
      .then(res => res.json())
      .then(data => {
        if (data.exists && data.state) {
          handleRemoteState(data.state, 'server_init');
        } else {
          // If server has no state for this room, seed it with our local state
          const currentState = window.AuctionState.get();
          broadcastState(currentState);
        }
      })
      .catch(err => console.warn('Failed to fetch initial room state:', err));

    // Connect to real-time SSE stream
    const sseUrl = `${origin}/api/events?room=${encodeURIComponent(currentRoom)}`;
    eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('connected', (e) => {
      try {
        const d = JSON.parse(e.data);
        connectedDeviceCount = d.connectedClients || 1;
        updateIndicator('online', `Wi-Fi Live (${connectedDeviceCount} device${connectedDeviceCount > 1 ? 's' : ''})`);
        updateUI();
      } catch (err) {}
    });

    eventSource.addEventListener('sync_state', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.fromDeviceId !== deviceId && d.state) {
          handleRemoteState(d.state, d.fromDeviceId);
        }
      } catch (err) {}
    });

    eventSource.addEventListener('sync_action', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.fromDeviceId !== deviceId) {
          handleRemoteAction(d.action, d.payload, d.state, d.fromDeviceId);
        }
      } catch (err) {}
    });

    eventSource.addEventListener('device_count', (e) => {
      try {
        const d = JSON.parse(e.data);
        connectedDeviceCount = d.count || 1;
        updateIndicator('online', `Wi-Fi Live (${connectedDeviceCount} device${connectedDeviceCount > 1 ? 's' : ''})`);
        updateUI();
      } catch (err) {}
    });

    eventSource.onerror = () => {
      updateIndicator('offline', 'Reconnecting Wi-Fi Sync...');
    };
  }

  // Connect via PeerJS WebRTC Cloud
  function connectPeerCloud() {
    syncMode = 'cloud_p2p';
    if (typeof Peer === 'undefined') {
      // Load PeerJS dynamically if not present
      loadScript('https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', () => {
        initPeerCloudInstance();
      });
      return;
    }
    initPeerCloudInstance();
  }

  function initPeerCloudInstance() {
    const hostPeerId = 'cricketcult-room-' + currentRoom.toLowerCase();

    // First try to join as Host (PC / first device in room)
    try {
      peer = new Peer(hostPeerId, {
        debug: 0
      });

      peer.on('open', (id) => {
        isHost = true;
        connectedDeviceCount = 1;
        updateIndicator('online', `Cloud Host (${currentRoom})`);
        updateUI();

        // Listen for phone client connections
        peer.on('connection', (conn) => {
          setupHostClientConnection(conn);
        });
      });

      peer.on('error', (err) => {
        // If peer ID is taken, another device (PC) is already the Host!
        // We connect as a Client Peer (Phone)!
        if (err.type === 'unavailable-id') {
          peer.destroy();
          initClientPeer(hostPeerId);
        } else {
          console.warn('PeerJS error:', err);
          updateIndicator('offline', 'Sync Standby (Local)');
        }
      });
    } catch (e) {
      console.warn('PeerJS init failed:', e);
      updateIndicator('offline', 'Sync Standby (Local)');
    }
  }

  // Connect as Client Peer to Host
  function initClientPeer(hostPeerId) {
    isHost = false;
    peer = new Peer();

    peer.on('open', (myId) => {
      hostConnection = peer.connect(hostPeerId, { reliable: true });

      hostConnection.on('open', () => {
        updateIndicator('online', `Cloud Connected (${currentRoom})`);
        updateUI();

        // Request initial state from Host
        hostConnection.send({
          type: 'REQUEST_STATE',
          fromDeviceId: deviceId
        });
      });

      hostConnection.on('data', (data) => {
        handlePeerMessage(data);
      });

      hostConnection.on('close', () => {
        updateIndicator('offline', 'Host Disconnected');
      });
    });

    peer.on('error', (err) => {
      console.warn('Client peer error:', err);
      updateIndicator('offline', 'Sync Standby');
    });
  }

  // Setup connection from a client phone to this host
  function setupHostClientConnection(conn) {
    peerConnections.set(conn.peer, conn);
    connectedDeviceCount = peerConnections.size + 1;
    updateIndicator('online', `Cloud Live (${connectedDeviceCount} devices)`);
    updateUI();

    // Send current state to newly joined phone immediately
    conn.on('open', () => {
      conn.send({
        type: 'STATE_UPDATE',
        state: window.AuctionState.get(),
        fromDeviceId: deviceId
      });
    });

    conn.on('data', (data) => {
      handlePeerMessage(data);
      // Host re-broadcasts message to all other connected phones
      for (const [peerId, otherConn] of peerConnections.entries()) {
        if (peerId !== conn.peer && otherConn.open) {
          try { otherConn.send(data); } catch (e) {}
        }
      }
    });

    conn.on('close', () => {
      peerConnections.delete(conn.peer);
      connectedDeviceCount = peerConnections.size + 1;
      updateIndicator('online', `Cloud Live (${connectedDeviceCount} device${connectedDeviceCount > 1 ? 's' : ''})`);
      updateUI();
    });
  }

  function handlePeerMessage(data) {
    if (!data || data.fromDeviceId === deviceId) return;

    if (data.type === 'REQUEST_STATE') {
      if (isHost && hostConnection) {
        hostConnection.send({
          type: 'STATE_UPDATE',
          state: window.AuctionState.get(),
          fromDeviceId: deviceId
        });
      }
    } else if (data.type === 'STATE_UPDATE') {
      handleRemoteState(data.state, data.fromDeviceId);
    } else if (data.type === 'ACTION') {
      handleRemoteAction(data.action, data.payload, data.state, data.fromDeviceId);
    }
  }

  // --- Dispatch Outgoing State to Connected Devices ---
  function broadcastState(state) {
    // 1. BroadcastChannel (same-machine tabs)
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'STATE_UPDATE',
          state,
          fromDeviceId: deviceId
        });
      } catch (e) {}
    }

    // 2. Local Node SSE Server
    if (syncMode === 'local_server' && serverInfo) {
      fetch(`${serverInfo.apiOrigin}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: currentRoom,
          state,
          deviceId
        })
      }).catch(e => console.warn('Failed to post state to server:', e));
    }

    // 3. WebRTC Cloud Peers
    if (syncMode === 'cloud_p2p') {
      const msg = {
        type: 'STATE_UPDATE',
        state,
        fromDeviceId: deviceId
      };
      if (isHost) {
        for (const conn of peerConnections.values()) {
          if (conn.open) try { conn.send(msg); } catch (e) {}
        }
      } else if (hostConnection && hostConnection.open) {
        try { hostConnection.send(msg); } catch (e) {}
      }
    }
  }

  // --- Dispatch High-Speed Action (Bid, Timer, Sold, Podium) ---
  function broadcastAction(action, payload, state) {
    // 1. BroadcastChannel
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'ACTION',
          action,
          payload,
          state,
          fromDeviceId: deviceId
        });
      } catch (e) {}
    }

    // 2. Local Node SSE Server
    if (syncMode === 'local_server' && serverInfo) {
      fetch(`${serverInfo.apiOrigin}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: currentRoom,
          action,
          payload,
          state,
          deviceId
        })
      }).catch(e => console.warn('Failed to post action to server:', e));
    }

    // 3. WebRTC Cloud Peers
    if (syncMode === 'cloud_p2p') {
      const msg = {
        type: 'ACTION',
        action,
        payload,
        state,
        fromDeviceId: deviceId
      };
      if (isHost) {
        for (const conn of peerConnections.values()) {
          if (conn.open) try { conn.send(msg); } catch (e) {}
        }
      } else if (hostConnection && hostConnection.open) {
        try { hostConnection.send(msg); } catch (e) {}
      }
    }
  }

  // --- Process Incoming State From Remote Device ---
  function handleRemoteState(incomingState, fromDev) {
    if (!incomingState || !incomingState.teams) return;
    window.AuctionState.applyRemoteState(incomingState);
  }

  // --- Process High-Speed Action From Remote Device ---
  function handleRemoteAction(action, payload, incomingState, fromDev) {
    if (incomingState) {
      window.AuctionState.applyRemoteState(incomingState);
    }

    if (action === 'BID_PLACED') {
      window.AuctionSound.playBid();
      if (window.AuctionLive && window.AuctionLive.resetTimer) {
        window.AuctionLive.resetTimer();
        window.AuctionLive.startTimer();
      }
      if (payload && payload.teamName) {
        window.AuctionApp.showToast(`🔔 Remote Bid: ${payload.teamName} (${window.AuctionState.formatMoney(payload.amount)})`, 'info');
      }
    } else if (action === 'PLAYER_SOLD') {
      window.AuctionSound.playGavel();
      setTimeout(() => {
        window.AuctionSound.playSold();
        window.AuctionConfetti.burst(120);
      }, 250);
      if (payload && payload.playerName && payload.teamName) {
        window.AuctionApp.showToast(`🔨 SOLD! ${payload.playerName} to ${payload.teamName}!`, 'success');
      }
    } else if (action === 'PODIUM_INTRO') {
      window.AuctionSound.playBid();
      if (window.AuctionLive && window.AuctionLive.startTimer) {
        window.AuctionLive.startTimer();
      }
      if (payload && payload.playerName) {
        window.AuctionApp.showToast(`🏏 Under the Hammer: ${payload.playerName}`, 'success');
      }
    } else if (action === 'AUCTION_PAUSED') {
      if (window.AuctionLive && window.AuctionLive.stopTimer) {
        window.AuctionLive.stopTimer();
      }
      window.AuctionApp.showToast('Bidding Paused by Auctioneer', 'info');
    } else if (action === 'AUCTION_RESUMED') {
      if (window.AuctionLive && window.AuctionLive.startTimer) {
        window.AuctionLive.startTimer();
      }
      window.AuctionApp.showToast('Bidding Resumed', 'success');
    } else if (action === 'TEAM_DELETED') {
      if (payload && payload.teamName) {
        window.AuctionApp.showToast(`Franchise "${payload.teamName}" removed by admin`, 'info');
      }
    } else if (action === 'PASSWORD_UPDATED') {
      if (payload && payload.teamName) {
        window.AuctionApp.showToast(`🔐 Credentials updated for ${payload.teamName}`, 'info');
      }
    }
  }

  // --- UI Update Helpers ---
  function updateIndicator(status, text) {
    const dot = document.getElementById('syncStatusDot');
    const label = document.getElementById('syncStatusLabel');
    const badge = document.getElementById('syncHeaderBtn');

    if (dot) {
      dot.className = 'sync-dot ' + status;
    }
    if (label) {
      label.textContent = text;
    }
    if (badge) {
      badge.setAttribute('title', `Room: ${currentRoom} · ${text}`);
    }
  }

  function getShareUrl() {
    let base = window.location.origin + window.location.pathname;
    if (serverInfo && serverInfo.localIps && serverInfo.localIps.length > 0) {
      base = `http://${serverInfo.localIps[0]}:${serverInfo.port}/`;
    }
    return `${base}?room=${currentRoom}`;
  }

  function setupSyncUI() {
    // Open Sync Modal Click Listener
    document.addEventListener('click', (e) => {
      if (e.target.closest('#syncHeaderBtn') || e.target.closest('[data-open-sync]')) {
        openSyncModal();
      }
      if (e.target.closest('#closeSyncModalBtn') || e.target.classList.contains('sync-modal-backdrop')) {
        closeSyncModal();
      }
      if (e.target.closest('#copyRoomLinkBtn')) {
        const link = getShareUrl();
        navigator.clipboard.writeText(link).then(() => {
          window.AuctionApp.showToast('Room link copied! Share with phones on WhatsApp/SMS', 'success');
        }).catch(() => {
          prompt('Copy this link for other devices:', link);
        });
      }
      if (e.target.closest('#btnChangeRoomSubmit')) {
        const inp = document.getElementById('syncRoomCodeInput');
        if (inp && inp.value.trim()) {
          setRoom(inp.value.trim());
          window.AuctionApp.showToast(`Switched to Room: ${currentRoom}`, 'success');
          updateSyncModalContent();
        }
      }
    });
  }

  function openSyncModal() {
    let modal = document.getElementById('syncModal');
    if (!modal) {
      renderSyncModalDOM();
      modal = document.getElementById('syncModal');
    }
    updateSyncModalContent();
    modal.classList.add('active');
  }

  function closeSyncModal() {
    const modal = document.getElementById('syncModal');
    if (modal) modal.classList.remove('active');
  }

  function updateSyncModalContent() {
    const shareUrl = getShareUrl();
    const qrContainer = document.getElementById('syncQrContainer');
    const urlDisplay = document.getElementById('syncUrlDisplay');
    const roomInput = document.getElementById('syncRoomCodeInput');
    const peerStatus = document.getElementById('syncPeerStatusText');
    const modeBadge = document.getElementById('syncModeBadge');

    if (qrContainer && window.AuctionQR) {
      window.AuctionQR.render(shareUrl, qrContainer, 180);
    }
    if (urlDisplay) {
      urlDisplay.value = shareUrl;
    }
    if (roomInput) {
      roomInput.value = currentRoom;
    }
    if (peerStatus) {
      peerStatus.textContent = `${connectedDeviceCount} device${connectedDeviceCount > 1 ? 's' : ''} currently synchronized in Room ${currentRoom}`;
    }
    if (modeBadge) {
      if (syncMode === 'local_server') {
        modeBadge.className = 'badge badge-lime';
        modeBadge.textContent = '⚡ High-Speed Wi-Fi Sync';
      } else if (syncMode === 'cloud_p2p') {
        modeBadge.className = 'badge badge-cyan';
        modeBadge.textContent = '☁️ Cloud WebRTC Room';
      } else {
        modeBadge.className = 'badge badge-gold';
        modeBadge.textContent = '🔒 Local Device Mode';
      }
    }
  }

  function renderSyncModalDOM() {
    const div = document.createElement('div');
    div.id = 'syncModal';
    div.className = 'modal-overlay sync-modal-backdrop';
    div.innerHTML = `
      <div class="modal-box sync-modal-box" onclick="event.stopPropagation()">
        <button id="closeSyncModalBtn" class="modal-close" aria-label="Close">&times;</button>
        
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <div style="width:44px; height:44px; border-radius:12px; background:rgba(6,182,212,0.15); border:1px solid rgba(6,182,212,0.3); display:flex; align-items:center; justify-content:center; font-size:22px;">
            📱
          </div>
          <div>
            <h3 style="font-size:19px; font-weight:800; line-height:1.2;">Multi-Device Live Sync</h3>
            <p style="font-size:12px; color:var(--text-secondary);">Connect phones, laptops & tablets to this live auction room</p>
          </div>
        </div>

        <div style="background:rgba(10,16,32,0.7); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px; margin-bottom:20px; display:flex; flex-direction:column; align-items:center; text-align:center;">
          <div style="margin-bottom:10px;">
            <span id="syncModeBadge" class="badge badge-lime">⚡ High-Speed Sync</span>
          </div>

          <div id="syncQrContainer" style="margin:10px 0; display:flex; justify-content:center;">
            <!-- Rendered by window.AuctionQR -->
          </div>

          <p style="font-size:13px; font-weight:700; color:var(--text-primary); margin-top:6px;">
            📸 Scan with Phone Camera
          </p>
          <p style="font-size:11px; color:var(--text-muted); max-width:280px; margin-top:2px;">
            Opens this exact auction room on your phone. Any bid or hammer strike updates both devices instantly!
          </p>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="display:flex; justify-content:space-between;">
            <span>Room Share Link</span>
            <span id="syncPeerStatusText" style="font-weight:600; color:var(--accent-lime); font-size:11px;">1 Device active</span>
          </label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="syncUrlDisplay" class="form-input" readonly style="font-family:var(--font-mono); font-size:12px; background:rgba(0,0,0,0.3);">
            <button id="copyRoomLinkBtn" class="btn btn-primary btn-sm" style="flex-shrink:0;">
              📋 Copy Link
            </button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:18px;">
          <label class="form-label">Active Room Code</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="syncRoomCodeInput" class="form-input" maxlength="12" style="font-family:var(--font-mono); text-transform:uppercase; font-weight:800; letter-spacing:0.1em;" placeholder="CULT26">
            <button id="btnChangeRoomSubmit" class="btn btn-secondary btn-sm" style="flex-shrink:0;">
              Change Room
            </button>
          </div>
        </div>

        <div style="border-top:1px solid var(--border-color); padding-top:14px; font-size:11px; color:var(--text-muted); line-height:1.5;">
          💡 <b>Tip for Franchise Captains:</b> Open this link on your phone, navigate to <b>⚡ Captain's Room</b>, and log in to bid with your private mobile paddle!
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function loadScript(src, callback) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = callback;
    document.head.appendChild(s);
  }

  function updateUI() {
    const badge = document.getElementById('syncHeaderBtn');
    if (badge) {
      badge.innerHTML = `
        <span id="syncStatusDot" class="sync-dot ${syncMode !== 'offline' ? 'online' : 'connecting'}"></span>
        <span id="syncStatusLabel">${syncMode === 'local_server' ? 'Wi-Fi Live' : 'Cloud Live'}: ${currentRoom} (${connectedDeviceCount})</span>
      `;
    }
  }

  return {
    init,
    setRoom,
    getRoom() { return currentRoom; },
    getDeviceCount() { return connectedDeviceCount; },
    getShareUrl,
    broadcastState,
    broadcastAction,
    openModal: openSyncModal,
    closeModal: closeSyncModal
  };
})();
