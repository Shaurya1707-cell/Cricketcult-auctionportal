/**
 * Captain's Portal & Bidder Console
 * Handles Captain authentication (ID/Password), secure franchise session,
 * tactical bidding paddle, and purse advisory analytics.
 */
window.AuctionCaptain = (function () {
  function init() {
    setupListeners();
  }

  function setupListeners() {
    // Delegation for login form and credentials quick-fill
    document.addEventListener('submit', (e) => {
      if (e.target && e.target.id === 'captainLoginForm') {
        e.preventDefault();
        const idInput = document.getElementById('captainLoginId');
        const passInput = document.getElementById('captainLoginPassword');
        const loginId = idInput ? idInput.value.trim() : '';
        const password = passInput ? passInput.value.trim() : '';

        const res = window.AuctionState.loginCaptain(loginId, password);
        if (res.success) {
          window.AuctionApp.showToast(`Welcome Captain ${res.team.captain}! Logged into ${res.team.name}`, 'success');
          window.AuctionSound.playBid();
          render();
        } else {
          window.AuctionApp.showToast(res.reason || 'Invalid Credentials', 'error');
          window.AuctionSound.playError();
        }
      }
    });

    document.addEventListener('click', (e) => {
      // Logout button
      if (e.target.closest('#btnCaptainLogout')) {
        window.AuctionState.logoutCaptain();
        window.AuctionApp.showToast('Captain logged out successfully', 'info');
        render();
        return;
      }
    });
  }

  function render() {
    const container = document.getElementById('captainPortalContent');
    if (!container) return;

    const team = window.AuctionState.getLoggedInCaptain();

    if (!team) {
      renderLoginForm(container);
    } else {
      renderAuthenticatedDashboard(container, team);
    }
  }

  function renderLoginForm(container) {
    const state = window.AuctionState.get();

    container.innerHTML = `
      <div class="admin-lock-screen" style="max-width: 520px; margin: 30px auto;">
        <div class="admin-lock-card" style="padding: 32px 28px;">
          <div class="admin-lock-icon" style="background: rgba(163, 230, 53, 0.15); border-color: rgba(163, 230, 53, 0.3);">
            ⚡
          </div>
          <h3 style="font-size: 22px; margin-bottom: 6px;">Franchise Captain Login</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 24px;">
            Enter your official Franchise Captain ID / Team Code and Password to enter your tactical bidding console.
          </p>

          <form id="captainLoginForm">
            <div class="form-group" style="text-align: left;">
              <label class="form-label">Captain ID or Team Code</label>
              <input 
                type="text" 
                id="captainLoginId" 
                class="form-input" 
                placeholder="e.g. captain_gg or GG24" 
                required
              >
            </div>

            <div class="form-group" style="text-align: left;">
              <label class="form-label">Password</label>
              <input 
                type="password" 
                id="captainLoginPassword" 
                class="form-input" 
                placeholder="Enter password" 
                required
              >
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 14px;">
              Enter Captain's Room ⚡
            </button>
          </form>

          <!-- Confidential Security Notice -->
          <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border-color); text-align: center;">
            <p style="font-size: 12px; color: var(--text-muted); margin: 0;">
              🔒 Authorized franchise captains only. Please contact your League Administrator for your confidential franchise ID and password.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  function renderAuthenticatedDashboard(container, team) {
    const state = window.AuctionState.get();
    const remainingPurse = team.budget - team.spent;
    const remainingSlots = team.limit - team.players.length;

    // Calculation: Safe maximum bid = remaining purse - (remaining empty slots - 1) * ₹500
    const reservedForFutureSlots = Math.max(0, (remainingSlots - 1) * 500);
    const maxSafeBid = Math.max(0, remainingPurse - reservedForFutureSlots);

    const isLive = !!state.current && !state.current.paused;
    const isLeading = state.current && state.current.highestTeamId === team.id;
    const activePlayer = state.current ? window.AuctionState.getPlayer(state.current.playerId) : null;

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding: 14px 20px; background: rgba(14, 23, 42, 0.8); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="font-size: 32px;">${team.icon || '🛡️'}</div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="font-size: 18px; margin: 0;">Captain ${window.AuctionState.escapeHTML(team.captain)}</h3>
              <span class="badge badge-lime">AUTHENTICATED</span>
              <span class="badge badge-gold">ID: ${window.AuctionState.escapeHTML(team.captainId || team.code)}</span>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">
              Franchise: <b>${window.AuctionState.escapeHTML(team.name)}</b> (${team.shortName || 'CC'})
            </div>
          </div>
        </div>

        <button id="btnCaptainLogout" class="btn btn-secondary btn-sm">
          🚪 Logout Captain
        </button>
      </div>

      <div class="captain-dashboard-grid">
        <!-- Left: Live Bidding Card & Purse Runway -->
        <div class="captain-stats-card">
          <div class="card-header">
            <div>
              <span class="eyebrow-tag">Live Paddle Status</span>
              <h3>Bidding Control</h3>
            </div>
            <span class="badge ${isLive ? 'badge-lime' : 'badge-gold'}">
              ${isLive ? 'AUCTION LIVE' : 'STANDBY'}
            </span>
          </div>

          <div class="team-purse-box" style="margin-top: 0;">
            <div class="team-purse-top">
              <span class="team-purse-label">Available Franchise Purse</span>
              <span class="team-purse-value">${window.AuctionState.formatMoney(remainingPurse)}</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width: ${Math.round((remainingPurse / team.budget) * 100)}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
              <span>Total Allocated: ${window.AuctionState.formatMoney(team.budget)}</span>
              <span>Spent: ${window.AuctionState.formatMoney(team.spent)}</span>
            </div>
          </div>

          <div class="grid-2" style="margin-top: 16px;">
            <div class="quick-stat-box">
              <div class="quick-stat-label">Max Affordable Bid</div>
              <div class="quick-stat-number" style="color: var(--accent-lime);">
                ${window.AuctionState.formatMoney(maxSafeBid)}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Reserves min ₹500 for future slots
              </div>
            </div>
            <div class="quick-stat-box">
              <div class="quick-stat-label">Squad Slots Left</div>
              <div class="quick-stat-number" style="color: var(--accent-cyan);">
                ${remainingSlots} / ${team.limit}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Remaining vacancies
              </div>
            </div>
          </div>

          <div style="margin-top: 24px;">
            ${isLive && activePlayer ? `
              <div style="padding: 14px; background: rgba(10, 16, 32, 0.7); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 14px;">
                <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Active Cricketer Under Hammer:</div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                  <b style="font-size: 17px;">${window.AuctionState.escapeHTML(activePlayer.name)} (${activePlayer.role})</b>
                  <b style="color: var(--accent-lime); font-family: var(--font-mono); font-size: 18px;">
                    ${window.AuctionState.formatMoney(state.current.bid || state.current.base)}
                  </b>
                </div>
              </div>

              <button 
                class="btn ${isLeading ? 'btn-secondary' : 'btn-primary'} btn-lg" 
                style="width: 100%; font-size: 16px;" 
                ${isLeading ? 'disabled' : ''} 
                onclick="window.AuctionLive.placeBid('${team.id}')"
              >
                ${isLeading ? '★ Your Franchise Is Leading' : `⚡ Raise Paddle As ${window.AuctionState.escapeHTML(team.name)}`}
              </button>
            ` : `
              <div class="badge badge-gold" style="width: 100%; justify-content: center; padding: 14px; font-size: 13px;">
                Waiting for Auctioneer to put player under hammer
              </div>
            `}
          </div>
        </div>

        <!-- Right: Current Signed Squad Roster -->
        <div class="captain-stats-card">
          <div class="card-header" style="flex-wrap: wrap; gap: 8px;">
            <div>
              <span class="eyebrow-tag">Acquired Squad</span>
              <h3>${team.players.length} Signed Cricketers</h3>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-lime">SPENT: ${window.AuctionState.formatMoney(team.spent)}</span>
              <button class="btn btn-secondary btn-sm" onclick="window.AuctionTeams.exportSingleTeamCSV('${team.id}')" title="Download this squad as CSV">
                📥 Squad CSV
              </button>
            </div>
          </div>

          <div class="team-squad-list" style="max-height: 420px;">
            ${team.players.length > 0 ? team.players.map(item => {
              const p = window.AuctionState.getPlayer(item.playerId);
              return `
                <div class="team-squad-item" style="padding: 12px;">
                  <div>
                    <div style="font-weight: 700;">${window.AuctionState.escapeHTML(p ? p.name : 'Player')}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${p ? `${p.role} · ${p.nation}` : ''}</div>
                  </div>
                  <b style="color: var(--accent-lime); font-family: var(--font-mono);">
                    ${window.AuctionState.formatMoney(item.price)}
                  </b>
                </div>
              `;
            }).join('') : `
              <div class="empty-state">
                <div style="font-size: 32px; margin-bottom: 8px;">🏏</div>
                <h4>Your Squad is Empty</h4>
                <p>You haven't purchased any players yet. Watch the live podium and bid when your targets arrive!</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  return {
    init,
    render
  };
})();
