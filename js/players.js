/**
 * Player Catalog & Pool Module
 * Handles player search, dynamic category filtering, table & grid rendering.
 */
window.AuctionPlayers = (function () {
  let activeRoleFilter = 'all';
  let activeStatusFilter = 'all';
  let searchQuery = '';
  let viewMode = 'grid'; // 'grid' | 'table'

  function init() {
    setupListeners();
  }

  function setupListeners() {
    const searchInput = document.getElementById('playerCatalogSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderPlayers();
      });
    }

    document.addEventListener('click', (e) => {
      const pill = e.target.closest('[data-player-filter]');
      if (pill) {
        document.querySelectorAll('[data-player-filter]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeRoleFilter = pill.dataset.playerFilter;
        renderPlayers();
      }

      const viewToggle = e.target.closest('[data-view-mode]');
      if (viewToggle) {
        document.querySelectorAll('[data-view-mode]').forEach(b => b.classList.remove('active'));
        viewToggle.classList.add('active');
        viewMode = viewToggle.dataset.viewMode;
        renderPlayers();
      }
    });
  }

  function renderPlayers() {
    const state = window.AuctionState.get();
    const countBadge = document.getElementById('playerPoolBadge');
    const container = document.getElementById('playerCatalogContainer');
    if (!container) return;

    let filtered = state.players.filter(p => {
      // Role filter
      if (activeRoleFilter !== 'all' && p.role.toLowerCase() !== activeRoleFilter.toLowerCase()) {
        if (activeRoleFilter === 'available' || activeRoleFilter === 'sold' || activeRoleFilter === 'unsold') {
          if (p.status !== activeRoleFilter) return false;
        } else {
          return false;
        }
      }

      // Search query
      if (searchQuery) {
        const text = `${p.name} ${p.role} ${p.nation} ${p.battingStyle || ''} ${p.bowlingStyle || ''}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }

      return true;
    });

    if (countBadge) {
      countBadge.textContent = `${filtered.length} OF ${state.players.length} PLAYERS`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h4>No Players Match Your Filter</h4>
          <p>Try adjusting your search criteria or role filters.</p>
        </div>
      `;
      return;
    }

    if (viewMode === 'grid') {
      renderGridView(filtered, container);
    } else {
      renderTableView(filtered, container);
    }
  }

  function renderGridView(players, container) {
    const roleEmoji = {
      'Batter': '🏏',
      'Bowler': '🎯',
      'All-rounder': '⚡',
      'Wicketkeeper': '🧤'
    };

    container.innerHTML = `
      <div class="player-grid-cards">
        ${players.map(p => {
          let statusBadgeClass = 'badge-lime';
          if (p.status === 'sold') statusBadgeClass = 'badge-rose';
          if (p.status === 'unsold') statusBadgeClass = 'badge-gold';

          return `
            <div class="player-single-card">
              <div>
                <div class="player-card-top">
                  <div class="player-avatar-mini">
                    ${roleEmoji[p.role] || '🏏'}
                  </div>
                  <div class="player-card-meta">
                    <span class="eyebrow-tag" style="font-size: 10px;">${window.AuctionState.escapeHTML(p.role)}</span>
                    <h4>${window.AuctionState.escapeHTML(p.name)}</h4>
                    <div class="player-card-role">
                      📍 ${window.AuctionState.escapeHTML(p.nation)} · ${p.rating}
                    </div>
                  </div>
                </div>

                <div class="player-stats-mini-row">
                  <div class="mini-stat-item">
                    <span>Matches</span>
                    <strong>${p.matches || 0}</strong>
                  </div>
                  <div class="mini-stat-item">
                    <span>${p.role === 'Bowler' ? 'Wickets' : 'Runs'}</span>
                    <strong>${p.role === 'Bowler' ? (p.wickets || 0) : (p.runs || 0)}</strong>
                  </div>
                  <div class="mini-stat-item">
                    <span>${p.role === 'Bowler' ? 'Econ / Avg' : 'SR'}</span>
                    <strong>${p.role === 'Bowler' ? (p.avg || '—') : (p.sr || '—')}</strong>
                  </div>
                </div>
              </div>

              <div class="player-card-footer">
                <div>
                  <span style="font-size: 10px; color: var(--text-muted); display: block; text-transform: uppercase;">
                    ${p.status === 'sold' ? 'Sold For' : 'Base Price'}
                  </span>
                  <span class="player-base-price">
                    ${window.AuctionState.formatMoney(p.status === 'sold' ? p.soldPrice : p.base)}
                  </span>
                </div>
                <span class="badge ${statusBadgeClass}">
                  ${p.status.toUpperCase()}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderTableView(players, container) {
    container.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Role</th>
              <th>Origin</th>
              <th>Base Price</th>
              <th>Matches</th>
              <th>Key Stats</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${players.map(p => `
              <tr>
                <td>
                  <b>${window.AuctionState.escapeHTML(p.name)}</b>
                  <div style="font-size: 11px; color: var(--text-muted);">${p.rating}</div>
                </td>
                <td>
                  <span class="badge badge-cyan">${window.AuctionState.escapeHTML(p.role)}</span>
                </td>
                <td>${window.AuctionState.escapeHTML(p.nation)}</td>
                <td>
                  <b style="color: var(--accent-lime); font-family: var(--font-mono);">
                    ${window.AuctionState.formatMoney(p.base)}
                  </b>
                </td>
                <td>${p.matches || 0}</td>
                <td style="font-size: 12px; color: var(--text-secondary);">
                  Runs: ${p.runs || 0} · Wkts: ${p.wickets || 0} · SR: ${p.sr || '—'}
                </td>
                <td>
                  <span class="badge ${p.status === 'sold' ? 'badge-rose' : p.status === 'unsold' ? 'badge-gold' : 'badge-lime'}">
                    ${p.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return {
    init,
    renderPlayers
  };
})();
