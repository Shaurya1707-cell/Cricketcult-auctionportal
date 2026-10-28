/**
 * Admin Console & Live Auction Controller
 * Handles PIN security, auction flow orchestration, credit allocation, team/player creation.
 */
window.AuctionAdmin = (function () {
  const DEMO_PIN = '1234';

  function init() {
    setupForms();
  }

  function unlock() {
    const pinInput = document.getElementById('adminPinInput');
    const entered = pinInput ? pinInput.value.trim() : '';

    if (entered === DEMO_PIN) {
      window.AuctionState.setAdminUnlocked(true);
      window.AuctionApp.showToast('Admin Console Unlocked', 'success');
      window.AuctionSound.playBid();
      if (pinInput) pinInput.value = '';
      render();
    } else {
      window.AuctionApp.showToast('Invalid Security PIN', 'error');
      window.AuctionSound.playError();
    }
  }

  function lock() {
    window.AuctionState.setAdminUnlocked(false);
    window.AuctionApp.showToast('Admin Console Locked', 'info');
    render();
  }

  function setupForms() {
    // Add Team Form
    const teamForm = document.getElementById('adminTeamForm');
    if (teamForm) {
      teamForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!window.AuctionState.isAdminUnlocked()) return;

        const name = document.getElementById('newTeamName').value.trim();
        const shortName = document.getElementById('newTeamShort').value.trim() || name.substring(0, 3).toUpperCase();
        const captain = document.getElementById('newCaptainName').value.trim();
        const captainId = (document.getElementById('newCaptainId')?.value.trim()) || ('captain_' + shortName.toLowerCase());
        const password = (document.getElementById('newCaptainPassword')?.value.trim()) || (shortName.toLowerCase() + '@123');
        const budget = parseInt(document.getElementById('newTeamPurse').value, 10) || 100000;
        const limit = parseInt(document.getElementById('newSquadLimit').value, 10) || 15;
        const icon = document.getElementById('newTeamIcon').value.trim() || '🛡️';

        const state = window.AuctionState.get();
        if (state.teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
          window.AuctionApp.showToast('A team with this name already exists', 'error');
          return;
        }

        const newId = 't_' + Date.now();
        state.teams.push({
          id: newId,
          name,
          shortName,
          captain,
          captainId,
          password,
          code: shortName + '24',
          budget,
          spent: 0,
          limit,
          icon,
          players: []
        });

        window.AuctionState.logActivity(`Admin registered new franchise: ${name} (Captain: ${captain})`);
        window.AuctionState.save();
        teamForm.reset();
        window.AuctionApp.showToast(`Franchise ${name} created!`, 'success');
      });
    }

    // Add Player Form
    const playerForm = document.getElementById('adminPlayerForm');
    if (playerForm) {
      playerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!window.AuctionState.isAdminUnlocked()) return;

        const name = document.getElementById('newPlayerName').value.trim();
        const role = document.getElementById('newPlayerRole').value;
        const nation = document.getElementById('newPlayerNation').value.trim() || 'India';
        const base = parseInt(document.getElementById('newPlayerBase').value, 10) || 2000;
        const rating = document.getElementById('newPlayerRating').value;
        const badge = document.getElementById('newPlayerBadge').value.trim() || 'Contender';

        const state = window.AuctionState.get();
        if (state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
          window.AuctionApp.showToast('A player with this name already exists', 'error');
          return;
        }

        const newId = 'p_' + Date.now();
        state.players.push({
          id: newId,
          name,
          role,
          nation,
          matches: Math.floor(Math.random() * 60) + 10,
          runs: role === 'Batter' || role === 'All-rounder' ? Math.floor(Math.random() * 2500) + 400 : 80,
          wickets: role === 'Bowler' || role === 'All-rounder' ? Math.floor(Math.random() * 80) + 20 : 0,
          avg: (Math.random() * 25 + 20).toFixed(1),
          sr: (Math.random() * 40 + 120).toFixed(1),
          base,
          rating,
          badge,
          status: 'available'
        });

        window.AuctionState.logActivity(`Admin introduced ${name} (${role}) to the auction catalogue`);
        window.AuctionState.save();
        playerForm.reset();
        window.AuctionApp.showToast(`Player ${name} added to auction pool!`, 'success');
      });
    }

    // Credit Allocation Form
    const creditForm = document.getElementById('adminCreditForm');
    if (creditForm) {
      creditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!window.AuctionState.isAdminUnlocked()) return;

        const teamId = document.getElementById('creditTargetTeam').value;
        const amount = parseInt(document.getElementById('creditAmountInput').value, 10);
        const reason = document.getElementById('creditReasonInput').value.trim() || 'Purse adjustment';

        if (!teamId || isNaN(amount) || amount === 0) {
          window.AuctionApp.showToast('Please specify a valid team and non-zero amount', 'error');
          return;
        }

        const team = window.AuctionState.getTeam(teamId);
        if (!team) return;

        team.budget += amount;
        window.AuctionState.logActivity(`Purse adjustment: ${window.AuctionState.formatMoney(amount)} for ${team.name} (${reason})`);
        window.AuctionState.save();
        creditForm.reset();
        window.AuctionApp.showToast(`Updated purse for ${team.name}`, 'success');
      });
    }

    // Squad Size & Roster Capacity Form
    const squadForm = document.getElementById('adminSquadSizeForm');
    if (squadForm) {
      squadForm.addEventListener('submit', handleSquadSizeSubmit);
    }

    const squadTargetSel = document.getElementById('squadSizeTargetTeam');
    if (squadTargetSel) {
      squadTargetSel.addEventListener('change', () => {
        const teamId = squadTargetSel.value;
        const input = document.getElementById('editSquadLimitInput');
        if (teamId && teamId !== 'all') {
          const team = window.AuctionState.getTeam(teamId);
          if (team && input) {
            input.value = team.limit || 15;
          }
        }
        updateSquadInfoBanner();
      });
    }

    // Delete Single Franchise Button in Backup & Reset
    const btnDeleteSingleTeam = document.getElementById('btnDeleteSingleTeam');
    if (btnDeleteSingleTeam) {
      btnDeleteSingleTeam.addEventListener('click', () => {
        if (!window.AuctionState.isAdminUnlocked()) {
          window.AuctionApp.showToast('Please unlock Admin Console first', 'error');
          return;
        }
        const sel = document.getElementById('deleteSingleTeamSelect');
        const teamId = sel ? sel.value : null;
        if (!teamId) {
          window.AuctionApp.showToast('Please select a franchise to delete first', 'error');
          return;
        }
        deleteFranchise(teamId);
      });
    }

    // Franchise Password Form
    const passwordForm = document.getElementById('adminPasswordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!window.AuctionState.isAdminUnlocked()) return;

        const teamId = document.getElementById('passwordTargetTeam')?.value;
        const newPass = document.getElementById('newPasswordInput')?.value.trim();

        if (!teamId || !newPass) {
          window.AuctionApp.showToast('Please select a franchise and enter a new password', 'error');
          return;
        }

        changeTeamPassword(teamId, newPass);
        const input = document.getElementById('newPasswordInput');
        if (input) input.value = '';
      });
    }

    const passwordTargetSel = document.getElementById('passwordTargetTeam');
    if (passwordTargetSel) {
      passwordTargetSel.addEventListener('change', () => {
        updatePasswordInfoBanner();
      });
    }

    // Auto-generate password button
    const btnGenPass = document.getElementById('btnGeneratePassword');
    if (btnGenPass) {
      btnGenPass.addEventListener('click', () => {
        const teamId = document.getElementById('passwordTargetTeam')?.value;
        const team = teamId ? window.AuctionState.getTeam(teamId) : null;
        const prefix = team ? (team.shortName || team.name.substring(0, 3)).toLowerCase() : 'cc';
        const num = Math.floor(Math.random() * 900) + 100;
        const symbols = ['@', '#', '$'];
        const sym = symbols[Math.floor(Math.random() * symbols.length)];
        const generated = `${prefix}${sym}${num}`;
        const input = document.getElementById('newPasswordInput');
        if (input) {
          input.value = generated;
          input.focus();
        }
      });
    }

    // Toggle reveal all passwords button
    const btnToggleAll = document.getElementById('btnToggleAllPasswords');
    if (btnToggleAll) {
      btnToggleAll.addEventListener('click', () => {
        allPasswordsRevealed = !allPasswordsRevealed;
        btnToggleAll.textContent = allPasswordsRevealed ? '🙈 Hide Passwords' : '👁️ Reveal All Passwords';
        renderPasswordList(allPasswordsRevealed);
      });
    }
  }

  let allPasswordsRevealed = false;

  // --- Franchise Password Management Handlers ---

  function updatePasswordInfoBanner() {
    const banner = document.getElementById('passwordCurrentInfo');
    const sel = document.getElementById('passwordTargetTeam');
    if (!banner || !sel) return;

    const teamId = sel.value;
    const state = window.AuctionState.get();

    if (!state.teams.length) {
      banner.innerHTML = `<span style="color: var(--text-muted);">No franchises registered yet. Register a franchise above first.</span>`;
      return;
    }

    const team = window.AuctionState.getTeam(teamId);
    if (!team) {
      banner.innerHTML = `<span style="color: var(--text-muted);">Select a franchise to view current credentials.</span>`;
      return;
    }

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
          <span>${team.icon || '🛡️'}</span> ${window.AuctionState.escapeHTML(team.name)}
        </span>
        <span class="badge badge-gold" style="font-size: 11px;">
          Captain: ${window.AuctionState.escapeHTML(team.captain)}
        </span>
      </div>
      <div style="color: var(--text-secondary); line-height: 1.5; font-size: 12px;">
        Official Login ID: <code style="color: var(--accent-cyan); font-weight: 700;">${window.AuctionState.escapeHTML(team.captainId || team.code)}</code> · 
        Current Password: <code style="color: var(--accent-gold); font-weight: 700; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${window.AuctionState.escapeHTML(team.password || 'Not set')}</code>
      </div>
    `;
  }

  function changeTeamPassword(teamId, newPassword) {
    if (!window.AuctionState.isAdminUnlocked()) {
      window.AuctionApp.showToast('Please unlock Admin Console first', 'error');
      return;
    }

    const team = window.AuctionState.getTeam(teamId);
    if (!team) {
      window.AuctionApp.showToast('Franchise not found', 'error');
      return;
    }

    const pass = String(newPassword || '').trim();
    if (!pass || pass.length < 3) {
      window.AuctionApp.showToast('Password must be at least 3 characters long', 'error');
      window.AuctionSound.playError();
      return;
    }

    const res = window.AuctionState.updateTeamPassword(teamId, pass);
    if (res && res.success) {
      window.AuctionSound.playBid();
      window.AuctionApp.showToast(`Updated password for ${team.name}! New password: "${pass}"`, 'success');
      render();
    } else {
      window.AuctionApp.showToast(res.reason || 'Failed to update password', 'error');
      window.AuctionSound.playError();
    }
  }

  function quickEditPassword(teamId) {
    if (!window.AuctionState.isAdminUnlocked()) {
      window.AuctionApp.showToast('Please unlock Admin Console first', 'error');
      return;
    }

    const team = window.AuctionState.getTeam(teamId);
    if (!team) return;

    const entered = prompt(`Enter new login password for ${team.name} (Captain: ${team.captain}):`, team.password || '');
    if (entered !== null) {
      const trimmed = entered.trim();
      if (!trimmed) {
        window.AuctionApp.showToast('Password cannot be empty', 'error');
        return;
      }
      changeTeamPassword(teamId, trimmed);
    }
  }

  function renderPasswordList(revealed = false) {
    const listEl = document.getElementById('adminPasswordList');
    if (!listEl) return;
    const state = window.AuctionState.get();

    if (!state.teams.length) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 14px; font-size: 12px; color: var(--text-muted);">
          No franchises registered yet — add a franchise above to configure credentials.
        </div>
      `;
      return;
    }

    listEl.innerHTML = state.teams.map(t => {
      const passText = revealed ? window.AuctionState.escapeHTML(t.password || 'None') : '••••••••';
      return `
        <div class="password-row">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
            <span style="font-size: 20px;">${t.icon || '🛡️'}</span>
            <div style="min-width: 0;">
              <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${window.AuctionState.escapeHTML(t.name)}
              </div>
              <div style="font-size: 11px; color: var(--text-muted);">
                Captain: <b style="color: var(--text-secondary);">${window.AuctionState.escapeHTML(t.captain)}</b> · ID: <code style="color: var(--accent-cyan);">${window.AuctionState.escapeHTML(t.captainId || t.code)}</code>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="password-display-pill" title="Franchise password">
              ${passText}
            </div>
            <button 
              type="button" 
              class="btn btn-secondary btn-sm" 
              onclick="window.AuctionAdmin.quickEditPassword('${t.id}')"
              title="Change password for ${window.AuctionState.escapeHTML(t.name)}"
              style="padding: 4px 8px; font-size: 11px;"
            >
              ✏️ Change
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Squad Size Management Handlers ---

  function updateSquadInfoBanner() {
    const banner = document.getElementById('squadSizeCurrentInfo');
    const squadTargetSel = document.getElementById('squadSizeTargetTeam');
    if (!banner || !squadTargetSel) return;

    const targetId = squadTargetSel.value;
    const state = window.AuctionState.get();

    if (!state.teams.length) {
      banner.innerHTML = `<span style="color: var(--text-muted);">No franchises registered yet. Register a franchise above first.</span>`;
      return;
    }

    if (targetId === 'all') {
      const limits = state.teams.map(t => t.limit || 15);
      const minLim = Math.min(...limits);
      const maxLim = Math.max(...limits);
      const rangeText = minLim === maxLim ? `${minLim} slots` : `${minLim} - ${maxLim} slots`;
      const totalSigned = state.teams.reduce((acc, t) => acc + t.players.length, 0);
      const totalCap = state.teams.reduce((acc, t) => acc + (t.limit || 15), 0);

      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; color: var(--accent-cyan); font-weight: 700; margin-bottom: 4px;">
          <span>🌐</span> League-Wide Mode
        </div>
        <div style="color: var(--text-secondary); line-height: 1.4;">
          Applying changes to all <b>${state.teams.length}</b> franchises simultaneously. Current limits range: <b>${rangeText}</b> (Total signed: <b>${totalSigned}/${totalCap}</b> slots filled).
        </div>
      `;
    } else {
      const team = window.AuctionState.getTeam(targetId);
      if (!team) {
        banner.innerHTML = `<span style="color: var(--text-muted);">Select a franchise to view current squad capacity.</span>`;
        return;
      }
      const currentLimit = team.limit || 15;
      const signed = team.players.length;
      const remainingSlots = Math.max(0, currentLimit - signed);
      const isFull = signed >= currentLimit;

      banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
            <span>${team.icon || '🛡️'}</span> ${window.AuctionState.escapeHTML(team.name)}
          </span>
          <span class="badge ${isFull ? 'badge-rose' : 'badge-cyan'}" style="font-size: 11px;">
            ${signed} / ${currentLimit} SQUAD ${isFull ? '(FULL)' : ''}
          </span>
        </div>
        <div style="color: var(--text-secondary); line-height: 1.4;">
          Current max squad capacity: <b>${currentLimit} players</b> · Signed: <b>${signed}</b> · Open slots remaining: <b style="color: ${remainingSlots > 0 ? 'var(--accent-lime)' : 'var(--accent-rose)'};">${remainingSlots}</b>.
        </div>
      `;
    }
  }

  function handleSquadSizeSubmit(e) {
    e.preventDefault();
    if (!window.AuctionState.isAdminUnlocked()) return;

    const target = document.getElementById('squadSizeTargetTeam')?.value;
    const newLimit = parseInt(document.getElementById('editSquadLimitInput')?.value, 10);

    if (isNaN(newLimit) || newLimit < 1) {
      window.AuctionApp.showToast('Please enter a valid squad limit (minimum 1)', 'error');
      return;
    }

    if (newLimit > 50) {
      window.AuctionApp.showToast('Squad limit cannot exceed 50 players', 'error');
      return;
    }

    const state = window.AuctionState.get();
    if (!state.teams.length) {
      window.AuctionApp.showToast('No franchises registered yet', 'error');
      return;
    }

    if (target === 'all') {
      applySquadLimitToAll(newLimit);
    } else {
      updateSingleTeamSquadLimit(target, newLimit);
    }
  }

  function updateSingleTeamSquadLimit(teamId, newLimit) {
    const team = window.AuctionState.getTeam(teamId);
    if (!team) {
      window.AuctionApp.showToast('Franchise not found', 'error');
      return false;
    }

    if (newLimit < team.players.length) {
      window.AuctionApp.showToast(
        `Cannot reduce squad size to ${newLimit}: ${team.name} already has ${team.players.length} signed players!`,
        'error'
      );
      window.AuctionSound.playError();
      return false;
    }

    const prev = team.limit || 15;
    team.limit = newLimit;

    window.AuctionState.logActivity(
      `Admin updated squad limit for ${team.name}: ${prev} ➔ ${newLimit} slots (${team.players.length} players signed)`
    );
    window.AuctionState.save();
    window.AuctionApp.showToast(`Updated squad limit for ${team.name} to ${newLimit} slots!`, 'success');
    window.AuctionSound.playBid();
    return true;
  }

  function applySquadLimitToAll(customLimit) {
    if (!window.AuctionState.isAdminUnlocked()) return;

    const newLimit = customLimit !== undefined 
      ? customLimit 
      : parseInt(document.getElementById('editSquadLimitInput')?.value, 10);

    if (isNaN(newLimit) || newLimit < 1) {
      window.AuctionApp.showToast('Please enter a valid squad limit (minimum 1)', 'error');
      return;
    }

    if (newLimit > 50) {
      window.AuctionApp.showToast('Squad limit cannot exceed 50 players', 'error');
      return;
    }

    const state = window.AuctionState.get();
    if (!state.teams.length) {
      window.AuctionApp.showToast('No franchises registered yet', 'error');
      return;
    }

    const conflicting = state.teams.filter(t => t.players.length > newLimit);
    if (conflicting.length > 0) {
      const detail = conflicting.map(t => `${t.name} (${t.players.length})`).join(', ');
      window.AuctionApp.showToast(
        `Cannot set league limit to ${newLimit}: Some teams have more players signed: ${detail}`,
        'error'
      );
      window.AuctionSound.playError();
      return;
    }

    state.teams.forEach(t => {
      t.limit = newLimit;
    });

    window.AuctionState.logActivity(
      `Admin set league-wide squad limit to ${newLimit} slots for all ${state.teams.length} franchises`
    );
    window.AuctionState.save();
    window.AuctionApp.showToast(`Set squad limit to ${newLimit} for all ${state.teams.length} franchises!`, 'success');
    window.AuctionSound.playBid();
  }

  function changeTeamSquadLimit(teamId, delta) {
    if (!window.AuctionState.isAdminUnlocked()) return;

    const team = window.AuctionState.getTeam(teamId);
    if (!team) return;

    const current = team.limit || 15;
    const target = current + delta;

    if (target < 1) {
      window.AuctionApp.showToast('Squad limit cannot be less than 1', 'error');
      return;
    }

    if (target > 50) {
      window.AuctionApp.showToast('Squad limit cannot exceed 50', 'error');
      return;
    }

    if (target < team.players.length) {
      window.AuctionApp.showToast(
        `Cannot reduce squad limit below signed players count (${team.players.length}) for ${team.name}`,
        'error'
      );
      window.AuctionSound.playError();
      return;
    }

    team.limit = target;
    window.AuctionState.logActivity(
      `Admin adjusted squad limit for ${team.name}: ${current} ➔ ${target} slots`
    );
    window.AuctionState.save();
    window.AuctionApp.showToast(`${team.name} squad limit: ${target} slots`, 'success');
    window.AuctionSound.playBid();
  }

  function setSquadLimitPreset(val) {
    const input = document.getElementById('editSquadLimitInput');
    if (input) {
      input.value = val;
      input.focus();
    }
  }

  function deleteFranchise(teamId) {
    if (!window.AuctionState.isAdminUnlocked()) {
      window.AuctionApp.showToast('Admin Console must be unlocked to delete franchises', 'error');
      return;
    }

    const team = window.AuctionState.getTeam(teamId);
    if (!team) {
      window.AuctionApp.showToast('Franchise not found', 'error');
      return;
    }

    const playerCount = team.players ? team.players.length : 0;
    const confirmMsg = playerCount > 0
      ? `Are you sure you want to delete the franchise "${team.name}"?\n\n⚠️ ${playerCount} signed player(s) on this roster will be returned to the available auction pool.`
      : `Are you sure you want to delete the franchise "${team.name}"?`;

    if (confirm(confirmMsg)) {
      const res = window.AuctionState.deleteTeam(teamId);
      if (res && res.success) {
        if (window.AuctionSound && window.AuctionSound.playGavel) {
          window.AuctionSound.playGavel();
        }
        window.AuctionApp.showToast(`Franchise "${team.name}" deleted successfully!`, 'success');
        render();
        if (typeof window.AuctionTeams !== 'undefined' && typeof window.AuctionTeams.renderAll === 'function') {
          window.AuctionTeams.renderAll();
        }
      } else {
        window.AuctionApp.showToast('Failed to delete franchise', 'error');
      }
    }
  }

  // --- Auction Workflow Orchestrator ---

  function startAuctionForPlayer(playerId) {
    if (!window.AuctionState.isAdminUnlocked()) return;
    const state = window.AuctionState.get();

    if (state.current) {
      window.AuctionApp.showToast('A player is already on the auction block!', 'error');
      return;
    }

    const p = window.AuctionState.getPlayer(playerId);
    if (!p || p.status !== 'available') {
      window.AuctionApp.showToast('Please select an available player', 'error');
      return;
    }

    state.current = {
      playerId: p.id,
      base: p.base,
      bid: 0,
      highestTeamId: null,
      bids: [],
      paused: false
    };

    window.AuctionState.logActivity(`🔔 Under the Hammer: ${p.name} at opening price of ${window.AuctionState.formatMoney(p.base)}`);
    window.AuctionSound.playBid();
    window.AuctionState.save();
    window.AuctionLive.startTimer();
    if (window.AuctionSync && typeof window.AuctionSync.broadcastAction === 'function') {
      window.AuctionSync.broadcastAction('PODIUM_INTRO', { playerName: p.name, base: p.base }, state);
    }
    window.AuctionApp.showToast(`${p.name} is now live!`, 'success');
    window.AuctionApp.navigateTo('auction');
  }

  function pauseAuction() {
    if (!window.AuctionState.isAdminUnlocked()) return;
    const state = window.AuctionState.get();
    if (!state.current) return;

    state.current.paused = true;
    window.AuctionLive.stopTimer();
    window.AuctionState.logActivity(`Auction paused by admin for ${window.AuctionState.getPlayer(state.current.playerId).name}`);
    window.AuctionState.save();
    if (window.AuctionSync && typeof window.AuctionSync.broadcastAction === 'function') {
      window.AuctionSync.broadcastAction('AUCTION_PAUSED', {}, state);
    }
    window.AuctionApp.showToast('Bidding Paused', 'info');
  }

  function resumeAuction() {
    if (!window.AuctionState.isAdminUnlocked()) return;
    const state = window.AuctionState.get();
    if (!state.current) return;

    state.current.paused = false;
    window.AuctionState.logActivity(`Auction resumed for ${window.AuctionState.getPlayer(state.current.playerId).name}`);
    window.AuctionState.save();
    window.AuctionLive.startTimer();
    if (window.AuctionSync && typeof window.AuctionSync.broadcastAction === 'function') {
      window.AuctionSync.broadcastAction('AUCTION_RESUMED', {}, state);
    }
    window.AuctionApp.showToast('Bidding Resumed', 'success');
  }

  function sellCurrentPlayer() {
    if (!window.AuctionState.isAdminUnlocked()) return;
    const state = window.AuctionState.get();
    const current = state.current;
    if (!current) {
      window.AuctionApp.showToast('No active auction to sell', 'error');
      return;
    }

    if (!current.highestTeamId) {
      window.AuctionApp.showToast('No bids placed yet. Cannot sell without a winning bid.', 'error');
      window.AuctionSound.playError();
      return;
    }

    const player = window.AuctionState.getPlayer(current.playerId);
    const team = window.AuctionState.getTeam(current.highestTeamId);
    const salePrice = current.bid || current.base;

    // Deduct purse and add player to roster
    team.spent += salePrice;
    team.players.push({
      playerId: player.id,
      price: salePrice,
      acquiredAt: Date.now()
    });

    player.status = 'sold';
    player.soldTo = team.id;
    player.soldPrice = salePrice;

    state.history.push({
      playerId: player.id,
      teamId: team.id,
      price: salePrice,
      timestamp: Date.now()
    });

    state.current = null;
    window.AuctionLive.stopTimer();

    // Celebration
    window.AuctionSound.playGavel();
    setTimeout(() => {
      window.AuctionSound.playSold();
      window.AuctionConfetti.burst(110);
    }, 250);

    window.AuctionState.logActivity(`🔨 SOLD! ${player.name} hammered down to ${team.name} for ${window.AuctionState.formatMoney(salePrice)}!`);
    window.AuctionState.save();
    if (window.AuctionSync && typeof window.AuctionSync.broadcastAction === 'function') {
      window.AuctionSync.broadcastAction('PLAYER_SOLD', {
        playerName: player.name,
        teamName: team.name,
        price: salePrice
      }, state);
    }
    window.AuctionApp.showToast(`${player.name} SOLD to ${team.name}!`, 'success');
  }

  function markPlayerUnsold() {
    if (!window.AuctionState.isAdminUnlocked()) return;
    const state = window.AuctionState.get();
    const current = state.current;
    if (!current) return;

    const player = window.AuctionState.getPlayer(current.playerId);
    player.status = 'unsold';

    state.current = null;
    window.AuctionLive.stopTimer();
    window.AuctionSound.playGavel();

    window.AuctionState.logActivity(`⚠️ UNSOLD: ${player.name} marked unsold (available in accelerated round)`);
    window.AuctionState.save();
    if (window.AuctionSync && typeof window.AuctionSync.broadcastAction === 'function') {
      window.AuctionSync.broadcastAction('PLAYER_UNSOLD', { playerName: player.name }, state);
    }
    window.AuctionApp.showToast(`${player.name} marked UNSOLD`, 'info');
  }

  function cancelCurrentAuction() {
    if (!window.AuctionState.isAdminUnlocked()) return;
    const state = window.AuctionState.get();
    if (!state.current) return;

    const player = window.AuctionState.getPlayer(state.current.playerId);
    state.current = null;
    window.AuctionLive.stopTimer();

    window.AuctionState.logActivity(`Auction cancelled for ${player.name}. Returned to pool.`);
    window.AuctionState.save();
    window.AuctionApp.showToast('Current player auction cancelled', 'info');
  }

  function render() {
    const isUnlocked = window.AuctionState.isAdminUnlocked();
    const lockScreen = document.getElementById('adminLockScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (!lockScreen || !dashboard) return;

    if (!isUnlocked) {
      lockScreen.style.display = 'block';
      dashboard.style.display = 'none';
      return;
    }

    lockScreen.style.display = 'none';
    dashboard.style.display = 'block';

    const state = window.AuctionState.get();

    // Populate next player dropdown
    const nextPlayerSel = document.getElementById('adminNextPlayerSelect');
    if (nextPlayerSel) {
      const avail = state.players.filter(p => p.status === 'available');
      nextPlayerSel.innerHTML = avail.length > 0 
        ? avail.map(p => `
          <option value="${p.id}">
            ${window.AuctionState.escapeHTML(p.name)} (${p.role} · ${window.AuctionState.formatMoney(p.base)})
          </option>
        `).join('')
        : `<option disabled>No players available in pool</option>`;
    }

    // Populate credit target team dropdown
    const creditTeamSel = document.getElementById('creditTargetTeam');
    if (creditTeamSel) {
      creditTeamSel.innerHTML = state.teams.length > 0 
        ? state.teams.map(t => `<option value="${t.id}">${window.AuctionState.escapeHTML(t.name)}</option>`).join('')
        : `<option disabled selected>No franchises registered yet — add a franchise below</option>`;
    }

    // Populate password target team dropdown
    const passwordTeamSel = document.getElementById('passwordTargetTeam');
    if (passwordTeamSel) {
      const prevPassVal = passwordTeamSel.value;
      if (state.teams.length > 0) {
        passwordTeamSel.innerHTML = state.teams.map(t => `
          <option value="${t.id}">
            ${t.icon || '🛡️'} ${window.AuctionState.escapeHTML(t.name)} (Captain: ${window.AuctionState.escapeHTML(teamCaptainDisplay(t))})
          </option>
        `).join('');
        if (prevPassVal && state.teams.some(t => t.id === prevPassVal)) {
          passwordTeamSel.value = prevPassVal;
        }
      } else {
        passwordTeamSel.innerHTML = `<option disabled selected>No franchises registered yet</option>`;
      }
    }

    // Helper for team captain display
    function teamCaptainDisplay(t) {
      return t.captain ? `${t.captain} · ID: ${t.captainId || t.code}` : (t.captainId || t.code);
    }

    // Update password info banner and credentials list
    updatePasswordInfoBanner();
    renderPasswordList(allPasswordsRevealed);

    // Populate squad size target team dropdown
    const squadTargetSel = document.getElementById('squadSizeTargetTeam');
    if (squadTargetSel) {
      const previousVal = squadTargetSel.value;
      if (state.teams.length > 0) {
        squadTargetSel.innerHTML = `
          <option value="all">🌐 All Franchises (League-Wide Limit)</option>
          ${state.teams.map(t => `
            <option value="${t.id}">
              ${t.icon || '🛡️'} ${window.AuctionState.escapeHTML(t.name)} (${t.players.length}/${t.limit || 15} signed)
            </option>
          `).join('')}
        `;
        if (previousVal && (previousVal === 'all' || state.teams.some(t => t.id === previousVal))) {
          squadTargetSel.value = previousVal;
        }
      } else {
        squadTargetSel.innerHTML = `<option disabled selected>No franchises registered yet — add a franchise above</option>`;
      }
    }

    // Update squad info banner
    updateSquadInfoBanner();

    // Populate delete single franchise dropdown
    const deleteTeamSel = document.getElementById('deleteSingleTeamSelect');
    if (deleteTeamSel) {
      if (state.teams.length > 0) {
        deleteTeamSel.innerHTML = `
          <option value="" disabled selected>Select a franchise to delete...</option>
          ${state.teams.map(t => `<option value="${t.id}">${t.icon || '🛡️'} ${window.AuctionState.escapeHTML(t.name)} (${t.players.length} signed)</option>`).join('')}
        `;
      } else {
        deleteTeamSel.innerHTML = `<option value="" disabled selected>No franchises registered</option>`;
      }
    }

    // Render Live Squad Limits Overview List
    const squadListEl = document.getElementById('adminSquadLimitsList');
    const squadSummaryEl = document.getElementById('adminSquadLimitsSummary');
    if (squadListEl) {
      if (state.teams.length === 0) {
        squadListEl.innerHTML = `
          <div class="empty-state" style="padding: 14px; font-size: 12px; color: var(--text-muted);">
            No franchises registered yet — add a franchise above to configure squad limits.
          </div>
        `;
        if (squadSummaryEl) squadSummaryEl.textContent = '';
      } else {
        const totalCap = state.teams.reduce((acc, t) => acc + (t.limit || 15), 0);
        const totalSigned = state.teams.reduce((acc, t) => acc + t.players.length, 0);

        if (squadSummaryEl) {
          squadSummaryEl.textContent = `${state.teams.length} Teams · ${totalCap} Slots (${totalSigned} Signed)`;
        }

        squadListEl.innerHTML = state.teams.map(t => {
          const currentLimit = t.limit || 15;
          const signed = t.players.length;
          const remaining = Math.max(0, currentLimit - signed);
          const isFull = signed >= currentLimit;

          return `
            <div class="squad-limit-row">
              <div class="squad-limit-team-info">
                <span style="font-size: 20px;">${t.icon || '🛡️'}</span>
                <div style="min-width: 0;">
                  <div class="squad-limit-team-name">${window.AuctionState.escapeHTML(t.name)}</div>
                  <div class="squad-limit-team-meta">
                    Signed: <b style="color: var(--text-primary);">${signed}</b> · Remaining: <b style="color: ${remaining > 0 ? 'var(--accent-lime)' : 'var(--accent-rose)'};">${remaining}</b>
                  </div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge ${isFull ? 'badge-rose' : 'badge-cyan'}" style="font-size: 10px;">
                  ${signed}/${currentLimit} ${isFull ? 'FULL' : 'SLOTS'}
                </span>
                <div class="squad-limit-controls">
                  <button 
                    type="button" 
                    class="squad-btn-stepper" 
                    title="Decrease squad limit by 1"
                    onclick="window.AuctionAdmin.changeTeamSquadLimit('${t.id}', -1)"
                    ${currentLimit <= signed || currentLimit <= 1 ? 'disabled' : ''}
                  >-</button>
                  <span class="squad-limit-pill">${currentLimit}</span>
                  <button 
                    type="button" 
                    class="squad-btn-stepper" 
                    title="Increase squad limit by 1"
                    onclick="window.AuctionAdmin.changeTeamSquadLimit('${t.id}', 1)"
                    ${currentLimit >= 50 ? 'disabled' : ''}
                  >+</button>
                  <button 
                    type="button" 
                    class="squad-btn-stepper squad-btn-delete" 
                    title="Delete franchise ${window.AuctionState.escapeHTML(t.name)}"
                    onclick="window.AuctionAdmin.deleteFranchise('${t.id}')"
                  >🗑️</button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Update Quick Stats
    const availCount = state.players.filter(p => p.status === 'available').length;
    const soldCount = state.players.filter(p => p.status === 'sold').length;
    const totalRemaining = state.teams.reduce((acc, t) => acc + (t.budget - t.spent), 0);

    const sAvail = document.getElementById('adminStatAvailable');
    const sSold = document.getElementById('adminStatSold');
    const sTeams = document.getElementById('adminStatTeams');
    const sPurse = document.getElementById('adminStatRemainingPurse');

    if (sAvail) sAvail.textContent = availCount;
    if (sSold) sSold.textContent = soldCount;
    if (sTeams) sTeams.textContent = state.teams.length;
    if (sPurse) sPurse.textContent = window.AuctionState.formatMoney(totalRemaining);
  }

  return {
    init,
    unlock,
    lock,
    startAuctionForPlayer,
    pauseAuction,
    resumeAuction,
    sellCurrentPlayer,
    markPlayerUnsold,
    cancelCurrentAuction,
    setSquadLimitPreset,
    applySquadLimitToAll,
    changeTeamSquadLimit,
    updateSquadSize: updateSingleTeamSquadLimit,
    deleteFranchise,
    changeTeamPassword,
    quickEditPassword,
    render
  };
})();
