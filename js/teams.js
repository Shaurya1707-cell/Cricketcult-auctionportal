/**
 * Franchise & Squads Management Module
 * Renders franchise cards, purse meters, squad composition and official sold register.
 * Provides CSV export for all teams, individual franchises, and sold players.
 */
window.AuctionTeams = (function () {
  function renderAll() {
    renderFranchises();
    renderSoldRegister();
  }

  function renderFranchises() {
    const state = window.AuctionState.get();
    const container = document.getElementById('franchisesGrid');
    const badge = document.getElementById('teamCountBadge');
    if (!container) return;

    if (badge) badge.textContent = `${state.teams.length} FRANCHISES`;

    if (!state.teams.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🛡️</div>
          <h4>No Franchises Configured</h4>
          <p>Create your first franchise team in the Admin Console to begin.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.teams.map(team => {
      const remaining = team.budget - team.spent;
      const pctLeft = Math.max(0, Math.min(100, Math.round((remaining / team.budget) * 100)));
      const isLowPurse = pctLeft < 20;

      return `
        <div class="team-franchise-card">
          <div class="team-card-banner">
            <div class="team-identity">
              <div class="team-badge-icon">
                ${team.icon || '🏏'}
              </div>
              <div class="team-info-text">
                <h3>${window.AuctionState.escapeHTML(team.name)}</h3>
                <div class="team-captain-label">
                  Captain: <b>${window.AuctionState.escapeHTML(team.captain)}</b>
                  <span 
                    class="badge badge-gold" 
                    style="font-size: 10px; margin-left: 6px; cursor: pointer;" 
                    onclick="window.AuctionTeams.changePassword('${team.id}')"
                    title="Click to change captain password"
                  >
                    ID: ${window.AuctionState.escapeHTML(team.captainId || team.code)} 🔑
                  </span>
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge ${team.players.length >= team.limit ? 'badge-rose' : 'badge-cyan'}">
                ${team.players.length} / ${team.limit} SQUAD
              </span>
              <button 
                type="button" 
                class="btn-delete-franchise" 
                onclick="window.AuctionTeams.deleteFranchise('${team.id}')"
                title="Delete franchise ${window.AuctionState.escapeHTML(team.name)}"
                aria-label="Delete franchise"
              >
                🗑️
              </button>
            </div>
          </div>

          <div class="team-purse-box">
            <div class="team-purse-top">
              <span class="team-purse-label">Available Purse</span>
              <span class="team-purse-value">${window.AuctionState.formatMoney(remaining)}</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill ${isLowPurse ? 'danger' : ''}" style="width: ${pctLeft}%;"></div>
            </div>
            <div class="team-squad-meta">
              <span>Total: ${window.AuctionState.formatMoney(team.budget)}</span>
              <span>Spent: ${window.AuctionState.formatMoney(team.spent)} (${100 - pctLeft}%)</span>
            </div>
          </div>

          <div class="card-header" style="margin-bottom: 10px; align-items: center;">
            <div>
              <span class="eyebrow-tag">Acquired Roster</span>
              <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${team.players.length} Players</span>
            </div>
            <div style="display: flex; gap: 6px;">
              <button 
                class="btn btn-secondary btn-sm" 
                onclick="window.AuctionTeams.exportSingleTeamCSV('${team.id}')"
                title="Download this team's squad roster as CSV"
              >
                📥 Team CSV
              </button>
              <button 
                class="btn btn-danger btn-sm" 
                onclick="window.AuctionTeams.deleteFranchise('${team.id}')"
                title="Delete this franchise"
              >
                🗑️ Delete
              </button>
            </div>
          </div>

          <div class="team-squad-list">
            ${team.players.length > 0 ? team.players.map(pItem => {
              const p = window.AuctionState.getPlayer(pItem.playerId);
              return `
                <div class="team-squad-item">
                  <div>
                    <span class="team-player-name">${window.AuctionState.escapeHTML(p ? p.name : 'Unknown')}</span>
                    <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${p ? p.role : ''}</span>
                  </div>
                  <span class="team-player-price">${window.AuctionState.formatMoney(pItem.price)}</span>
                </div>
              `;
            }).join('') : `
              <div class="empty-state" style="padding: 16px; border: 1px dashed var(--border-color);">
                <div style="font-size: 12px; color: var(--text-muted);">No players signed yet. Ready to bid!</div>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSoldRegister() {
    const state = window.AuctionState.get();
    const container = document.getElementById('soldPlayersRegister');
    if (!container) return;

    const soldPlayers = state.players.filter(p => p.status === 'sold');

    if (soldPlayers.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div style="font-size: 28px; margin-bottom: 6px;">📋</div>
          <h4>No Official Sales Yet</h4>
          <p>When players are hammered down, they will be registered here with sale price and franchise info.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Player Name</th>
              <th>Role</th>
              <th>Winning Franchise</th>
              <th>Sold Price</th>
              <th>Base Price</th>
              <th>Hike %</th>
            </tr>
          </thead>
          <tbody>
            ${soldPlayers.map(p => {
              const team = window.AuctionState.getTeam(p.soldTo);
              const hike = Math.round(((p.soldPrice - p.base) / p.base) * 100);
              return `
                <tr>
                  <td>
                    <b>${window.AuctionState.escapeHTML(p.name)}</b>
                    <div style="font-size: 11px; color: var(--text-muted);">${p.nation}</div>
                  </td>
                  <td>
                    <span class="badge badge-cyan">${window.AuctionState.escapeHTML(p.role)}</span>
                  </td>
                  <td>
                    <b>${window.AuctionState.escapeHTML(team ? team.name : '—')}</b>
                    <div style="font-size: 11px; color: var(--text-muted);">${team ? `Capt. ${team.captain}` : ''}</div>
                  </td>
                  <td>
                    <b style="color: var(--accent-lime); font-family: var(--font-mono); font-size: 15px;">
                      ${window.AuctionState.formatMoney(p.soldPrice)}
                    </b>
                  </td>
                  <td>
                    <span style="font-family: var(--font-mono); color: var(--text-secondary);">
                      ${window.AuctionState.formatMoney(p.base)}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${hike > 50 ? 'badge-lime' : 'badge-gold'}">
                      +${hike}%
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // --- CSV Export Engine ---

  function csvEscape(value) {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function triggerDownload(filename, csvText) {
    // Add UTF-8 BOM so Microsoft Excel correctly displays all characters and columns
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    window.AuctionApp.showToast(`CSV downloaded: ${filename}`, 'success');
  }

  /**
   * Export Master CSV containing all teams and their purchased players
   */
  function exportAllTeamsCSV() {
    const state = window.AuctionState.get();
    if (!state.teams || state.teams.length === 0) {
      window.AuctionApp.showToast('No franchise teams registered to export', 'error');
      return;
    }

    const headers = [
      'Franchise Name',
      'Short Code',
      'Captain Name',
      'Player Name',
      'Role',
      'Country',
      'Sold Price (INR)',
      'Base Price (INR)',
      'Total Team Budget (INR)',
      'Total Team Spent (INR)',
      'Remaining Purse (INR)',
      'Squad Capacity'
    ];

    const rows = [];
    rows.push(headers.map(csvEscape).join(','));

    let totalSoldRecorded = 0;

    state.teams.forEach(team => {
      const remaining = team.budget - team.spent;
      const squadRatio = `${team.players.length}/${team.limit}`;

      if (team.players && team.players.length > 0) {
        team.players.forEach(item => {
          totalSoldRecorded++;
          const p = window.AuctionState.getPlayer(item.playerId);
          rows.push([
            team.name,
            team.shortName || '',
            team.captain,
            p ? p.name : 'Unknown Player',
            p ? p.role : 'N/A',
            p ? p.nation : 'N/A',
            item.price,
            p ? p.base : 0,
            team.budget,
            team.spent,
            remaining,
            squadRatio
          ].map(csvEscape).join(','));
        });
      } else {
        // Row for team with no players bought yet
        rows.push([
          team.name,
          team.shortName || '',
          team.captain,
          '(No players bought yet)',
          '—',
          '—',
          0,
          0,
          team.budget,
          team.spent,
          remaining,
          squadRatio
        ].map(csvEscape).join(','));
      }
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `cricket_auction_teams_and_players_${timestamp}.csv`;
    triggerDownload(filename, rows.join('\r\n'));
  }

  /**
   * Export CSV of a specific franchise squad
   */
  function exportSingleTeamCSV(teamId) {
    const team = window.AuctionState.getTeam(teamId);
    if (!team) return;

    const remaining = team.budget - team.spent;

    const rows = [
      ['FRANCHISE SQUAD REPORT', team.name].map(csvEscape).join(','),
      ['Captain', team.captain].map(csvEscape).join(','),
      ['Total Purse Budget (INR)', team.budget].map(csvEscape).join(','),
      ['Total Purse Spent (INR)', team.spent].map(csvEscape).join(','),
      ['Remaining Purse (INR)', remaining].map(csvEscape).join(','),
      ['Squad Size', `${team.players.length} / ${team.limit}`].map(csvEscape).join(','),
      [], // blank line
      ['Player Name', 'Role', 'Country', 'Purchase Price (INR)', 'Base Price (INR)'].map(csvEscape).join(',')
    ];

    if (team.players && team.players.length > 0) {
      team.players.forEach(item => {
        const p = window.AuctionState.getPlayer(item.playerId);
        rows.push([
          p ? p.name : 'Player',
          p ? p.role : '',
          p ? p.nation : '',
          item.price,
          p ? p.base : 0
        ].map(csvEscape).join(','));
      });
    } else {
      rows.push(['(No players bought yet)', '', '', 0, 0].map(csvEscape).join(','));
    }

    const cleanName = (team.shortName || team.name).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanName}_squad_roster.csv`;
    triggerDownload(filename, rows.join('\r\n'));
  }

  /**
   * Export CSV of the official Sold Register
   */
  function exportSoldPlayersCSV() {
    const state = window.AuctionState.get();
    const soldPlayers = state.players.filter(p => p.status === 'sold');

    if (soldPlayers.length === 0) {
      window.AuctionApp.showToast('No players have been sold yet to export', 'info');
      return;
    }

    const headers = [
      'Player Name',
      'Role',
      'Country',
      'Winning Franchise',
      'Captain',
      'Sold Price (INR)',
      'Base Price (INR)',
      'Price Hike (%)'
    ];

    const rows = [headers.map(csvEscape).join(',')];

    soldPlayers.forEach(p => {
      const team = window.AuctionState.getTeam(p.soldTo);
      const hike = Math.round(((p.soldPrice - p.base) / p.base) * 100);
      rows.push([
        p.name,
        p.role,
        p.nation,
        team ? team.name : 'Unknown',
        team ? team.captain : '',
        p.soldPrice,
        p.base,
        `${hike}%`
      ].map(csvEscape).join(','));
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `cricket_auction_sold_register_${timestamp}.csv`;
    triggerDownload(filename, rows.join('\r\n'));
  }

  function deleteFranchise(teamId) {
    const team = window.AuctionState.getTeam(teamId);
    if (!team) {
      window.AuctionApp.showToast('Franchise not found', 'error');
      return;
    }

    const playerCount = team.players ? team.players.length : 0;
    const confirmMsg = playerCount > 0
      ? `Are you sure you want to delete the franchise "${team.name}"?\n\n⚠️ ${playerCount} signed player(s) on this roster will be released back into the available auction pool.`
      : `Are you sure you want to delete the franchise "${team.name}"?`;

    if (confirm(confirmMsg)) {
      const res = window.AuctionState.deleteTeam(teamId);
      if (res && res.success) {
        if (window.AuctionSound && window.AuctionSound.playGavel) {
          window.AuctionSound.playGavel();
        }
        window.AuctionApp.showToast(`Franchise "${team.name}" deleted successfully!`, 'success');
        renderAll();
      } else {
        window.AuctionApp.showToast('Failed to delete franchise', 'error');
      }
    }
  }

  function changePassword(teamId) {
    const team = window.AuctionState.getTeam(teamId);
    if (!team) return;

    const currentPass = team.password || '';
    const newPass = prompt(`Change login password for ${team.name} (Captain: ${team.captain}):\nCurrent password: "${currentPass}"\n\nEnter new password:`, currentPass);
    if (newPass !== null) {
      const trimmed = newPass.trim();
      if (!trimmed || trimmed.length < 3) {
        window.AuctionApp.showToast('Password must be at least 3 characters long', 'error');
        return;
      }
      const res = window.AuctionState.updateTeamPassword(teamId, trimmed);
      if (res && res.success) {
        if (window.AuctionSound && window.AuctionSound.playBid) window.AuctionSound.playBid();
        window.AuctionApp.showToast(`Password updated for ${team.name}! New password: "${trimmed}"`, 'success');
        renderAll();
      } else {
        window.AuctionApp.showToast(res.reason || 'Failed to update password', 'error');
      }
    }
  }

  return {
    renderAll,
    deleteFranchise,
    changePassword,
    exportAllTeamsCSV,
    exportSingleTeamCSV,
    exportSoldPlayersCSV
  };
})();
