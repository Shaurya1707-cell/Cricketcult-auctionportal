/**
 * Live Auction Engine & Bidding Stage
 * Handles the live podium, timer countdown, bid increment calculations and paddle bidding.
 */
window.AuctionLive = (function () {
  let selectedIncrement = 500;
  let timerInterval = null;
  let timerSecondsLeft = 15;
  const COUNTDOWN_TOTAL = 15;

  function init() {
    setupIncrementListeners();
  }

  function setupIncrementListeners() {
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.increment-chip');
      if (chip) {
        document.querySelectorAll('.increment-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedIncrement = parseInt(chip.dataset.inc, 10) || 500;
        renderPaddles();
      }
    });
  }

  function startTimer() {
    stopTimer();
    const state = window.AuctionState.get();
    if (!state.current || state.current.paused) return;

    timerSecondsLeft = COUNTDOWN_TOTAL;
    updateTimerUI();

    timerInterval = setInterval(() => {
      timerSecondsLeft--;
      updateTimerUI();

      if (timerSecondsLeft === 10) {
        window.AuctionSound.playTick();
      } else if (timerSecondsLeft === 5) {
        window.AuctionSound.playTick();
      } else if (timerSecondsLeft <= 3 && timerSecondsLeft > 0) {
        window.AuctionSound.playTick();
      } else if (timerSecondsLeft <= 0) {
        stopTimer();
        // If there is a winning bid, auto hammer or prompt admin
        if (state.current.highestTeamId) {
          window.AuctionSound.playGavel();
        }
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    timerSecondsLeft = COUNTDOWN_TOTAL;
    updateTimerUI();
  }

  function updateTimerUI() {
    const fill = document.getElementById('hammerProgressFill');
    const label = document.getElementById('hammerCountdownLabel');
    if (!fill || !label) return;

    const state = window.AuctionState.get();
    if (!state.current) {
      fill.style.width = '0%';
      label.textContent = 'Standby';
      return;
    }

    if (state.current.paused) {
      label.textContent = 'Bidding Paused';
      fill.style.background = 'var(--accent-gold)';
      return;
    }

    const pct = Math.max(0, (timerSecondsLeft / COUNTDOWN_TOTAL) * 100);
    fill.style.width = pct + '%';
    fill.style.background = timerSecondsLeft <= 5 ? 'var(--grad-danger)' : 'var(--grad-primary)';

    if (timerSecondsLeft > 10) {
      label.textContent = `Bidding open (${timerSecondsLeft}s)`;
    } else if (timerSecondsLeft > 5) {
      label.textContent = `Going once... (${timerSecondsLeft}s)`;
    } else if (timerSecondsLeft > 0) {
      label.textContent = `Going twice! Final calls (${timerSecondsLeft}s)`;
    } else {
      label.textContent = `Hammer Down! Awaiting confirmation`;
    }
  }

  function canTeamBid(team, current, nextBid) {
    if (!current || current.paused) return { allowed: false, reason: 'Auction paused or empty' };
    if (current.highestTeamId === team.id) return { allowed: false, reason: 'Already highest bidder' };

    const loggedCaptain = window.AuctionState.getLoggedInCaptain();
    if (loggedCaptain && loggedCaptain.id !== team.id) {
      return { allowed: false, reason: `Logged in as Captain of ${loggedCaptain.name}. You can only bid with your team's paddle.` };
    }
    
    const remainingPurse = team.budget - team.spent;
    if (remainingPurse < nextBid) {
      return { allowed: false, reason: 'Insufficient purse balance' };
    }

    if (team.players.length >= team.limit) {
      return { allowed: false, reason: 'Squad limit reached' };
    }

    // Minimum purse reservation check (reserve ₹500 for each remaining unfilled slot)
    const emptySlots = (team.limit - team.players.length) - 1;
    const reservedPurse = emptySlots * 500;
    if ((remainingPurse - nextBid) < reservedPurse) {
      return { allowed: false, reason: `Must reserve ₹${reservedPurse} for remaining slots` };
    }

    return { allowed: true };
  }

  function placeBid(teamId) {
    const state = window.AuctionState.get();
    const current = state.current;
    if (!current || current.paused) {
      window.AuctionApp.showToast('Bidding is not open at the moment', 'error');
      window.AuctionSound.playError();
      return;
    }

    const team = window.AuctionState.getTeam(teamId);
    if (!team) return;

    const player = window.AuctionState.getPlayer(current.playerId);
    const currentBid = current.bid || current.base;
    const nextBid = current.bid ? (current.bid + selectedIncrement) : current.base;

    const check = canTeamBid(team, current, nextBid);
    if (!check.allowed) {
      window.AuctionApp.showToast(`${team.name}: ${check.reason}`, 'error');
      window.AuctionSound.playError();
      return;
    }

    // Register Bid
    current.bid = nextBid;
    current.highestTeamId = team.id;
    current.bids.push({
      teamId: team.id,
      amount: nextBid,
      time: Date.now()
    });

    window.AuctionSound.playBid();
    window.AuctionState.logActivity(`${team.name} raised bid to ${window.AuctionState.formatMoney(nextBid)} for ${player.name}`);
    window.AuctionApp.showToast(`New Leader: ${team.name} (${window.AuctionState.formatMoney(nextBid)})`, 'info');

    // Reset countdown timer on new valid bid
    resetTimer();
    startTimer();
    window.AuctionState.save();
  }

  function renderHeroStats() {
    const state = window.AuctionState.get();
    const available = state.players.filter(p => p.status === 'available').length;
    const sold = state.players.filter(p => p.status === 'sold').length;
    const unsold = state.players.filter(p => p.status === 'unsold').length;
    const totalCredits = state.teams.reduce((acc, t) => acc + t.budget, 0);

    const elAvail = document.getElementById('statAvailable');
    const elTeams = document.getElementById('statTeams');
    const elSold = document.getElementById('statSold');
    const elCredits = document.getElementById('statCredits');

    if (elAvail) elAvail.textContent = available;
    if (elTeams) elTeams.textContent = state.teams.length;
    if (elSold) elSold.textContent = sold;
    if (elCredits) elCredits.textContent = window.AuctionState.formatMoney(totalCredits);
  }

  function renderPodium() {
    const state = window.AuctionState.get();
    const current = state.current;
    const area = document.getElementById('livePlayerPodium');
    if (!area) return;

    if (!current) {
      stopTimer();
      area.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏏</div>
          <h4>Podium is Clear</h4>
          <p>No player is currently on the auction block. The admin will bring up the next marquee cricketer.</p>
          <button class="btn btn-secondary btn-sm" onclick="window.AuctionApp.navigateTo('admin')">
            Open Admin Control Room ↗
          </button>
        </div>
      `;
      updateTimerUI();
      return;
    }

    const player = window.AuctionState.getPlayer(current.playerId);
    const leaderTeam = window.AuctionState.getTeam(current.highestTeamId);
    const roleEmoji = {
      'Batter': '🏏',
      'Bowler': '🎯',
      'All-rounder': '⚡',
      'Wicketkeeper': '🧤'
    }[player.role] || '🏏';

    const currentPrice = current.bid || current.base;

    area.innerHTML = `
      <div class="player-podium ${current.paused ? 'paused' : ''}">
        <div class="podium-header">
          <span class="badge ${current.paused ? 'badge-gold' : 'badge-lime'}">
            ${current.paused ? '⏸ Bidding Paused' : '🔴 LIVE AUCTION'}
          </span>
          <span class="badge badge-purple">${window.AuctionState.escapeHTML(player.badge || 'Contender')}</span>
        </div>

        <div class="podium-main-info">
          <div class="podium-avatar">
            ${roleEmoji}
          </div>
          <div class="podium-details">
            <span class="eyebrow-tag">${window.AuctionState.escapeHTML(player.role)}</span>
            <h2>${window.AuctionState.escapeHTML(player.name)}</h2>
            <div class="podium-meta">
              <span>📍 ${window.AuctionState.escapeHTML(player.nation)}</span>
              <span>🏏 ${window.AuctionState.escapeHTML(player.battingStyle || 'Right-hand bat')}</span>
              <span>⭐ ${window.AuctionState.escapeHTML(player.rating)}</span>
            </div>
          </div>
          <div class="podium-price-box">
            <div class="podium-price-label">${current.bid ? 'CURRENT HIGHEST BID' : 'STARTING BASE PRICE'}</div>
            <div class="podium-price-amount">${window.AuctionState.formatMoney(currentPrice)}</div>
            <div class="podium-price-leader">
              ${leaderTeam ? `Leading: <b>${window.AuctionState.escapeHTML(leaderTeam.name)}</b>` : 'No bids placed yet'}
            </div>
          </div>
        </div>

        <div class="podium-stats-grid">
          <div class="podium-stat-pill">
            <span>Matches</span>
            <strong>${player.matches || 0}</strong>
          </div>
          <div class="podium-stat-pill">
            <span>Runs / Wkts</span>
            <strong>${player.runs || 0} / ${player.wickets || 0}</strong>
          </div>
          <div class="podium-stat-pill">
            <span>Batting Avg</span>
            <strong>${player.avg || '—'}</strong>
          </div>
          <div class="podium-stat-pill">
            <span>Strike Rate</span>
            <strong>${player.sr || '—'}</strong>
          </div>
        </div>

        <div class="hammer-timer-wrap">
          <div class="hammer-indicator">
            <span>🔨</span>
            <span id="hammerCountdownLabel">Countdown</span>
          </div>
          <div class="hammer-progress-bar">
            <div id="hammerProgressFill" class="hammer-progress-fill"></div>
          </div>
        </div>
      </div>
    `;

    updateTimerUI();
  }

  function renderPaddles() {
    const state = window.AuctionState.get();
    const grid = document.getElementById('biddingPaddlesGrid');
    if (!grid) return;

    const current = state.current;
    if (!current) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 20px;">Standby for player auction...</div>`;
      return;
    }

    const nextBid = current.bid ? (current.bid + selectedIncrement) : current.base;
    const loggedCaptain = window.AuctionState.getLoggedInCaptain();

    grid.innerHTML = state.teams.map(t => {
      const check = canTeamBid(t, current, nextBid);
      const isLeader = current.highestTeamId === t.id;
      const isMyTeam = loggedCaptain && loggedCaptain.id === t.id;
      const remainingPurse = t.budget - t.spent;

      return `
        <button 
          class="bid-paddle-btn ${isLeader ? 'leading' : ''} ${isMyTeam ? 'my-franchise' : ''}" 
          ${!check.allowed ? 'disabled' : ''} 
          onclick="window.AuctionLive.placeBid('${t.id}')"
          title="${check.reason || (isMyTeam ? 'Your franchise paddle' : 'Click to place bid')}"
        >
          <div class="paddle-team-name">
            <span>${t.icon || '🛡️'}</span>
            <span>${window.AuctionState.escapeHTML(t.name)}</span>
            ${isMyTeam ? '<span class="badge badge-lime" style="font-size: 9px; margin-left: auto;">👑 YOUR TEAM</span>' : ''}
          </div>
          <div class="paddle-purse-info">
            Purse: ${window.AuctionState.formatMoney(remainingPurse)} · Squad: ${t.players.length}/${t.limit}
          </div>
          <div class="paddle-bid-amount">
            ${isLeader ? '★ CURRENT LEADER' : `BID ${window.AuctionState.formatMoney(nextBid)}`}
          </div>
        </button>
      `;
    }).join('');
  }

  function renderActivity() {
    const state = window.AuctionState.get();
    const list = document.getElementById('liveActivityFeed');
    if (!list) return;

    if (!state.activity || state.activity.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding: 18px;">No auction events recorded yet.</div>`;
      return;
    }

    list.innerHTML = state.activity.slice(0, 8).map(act => {
      const d = new Date(act.time);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `
        <div class="activity-item">
          <div>
            <span>${window.AuctionState.escapeHTML(act.text)}</span>
          </div>
          <div class="activity-item-time">${timeStr}</div>
        </div>
      `;
    }).join('');
  }

  function renderLeaderboard() {
    const state = window.AuctionState.get();
    const board = document.getElementById('purseLeaderboard');
    if (!board) return;

    const sorted = [...state.teams].sort((a, b) => (b.budget - b.spent) - (a.budget - a.spent));
    board.innerHTML = sorted.map((t, idx) => {
      const remaining = t.budget - t.spent;
      return `
        <div class="activity-item" style="margin-bottom: 8px;">
          <div>
            <span class="badge ${idx === 0 ? 'badge-gold' : 'badge-cyan'}">#${idx + 1}</span>
            <b style="margin-left: 6px;">${window.AuctionState.escapeHTML(t.name)}</b>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
              ${t.players.length} Players Signed · Capt. ${window.AuctionState.escapeHTML(t.captain)}
            </div>
          </div>
          <div style="text-align: right;">
            <b style="color: var(--accent-lime); font-family: var(--font-mono);">${window.AuctionState.formatMoney(remaining)}</b>
            <div style="font-size: 10px; color: var(--text-muted);">${Math.round((remaining / t.budget) * 100)}% purse left</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAll() {
    renderHeroStats();
    renderPodium();
    renderPaddles();
    renderActivity();
    renderLeaderboard();
  }

  return {
    init,
    placeBid,
    startTimer,
    stopTimer,
    resetTimer,
    renderAll
  };
})();
