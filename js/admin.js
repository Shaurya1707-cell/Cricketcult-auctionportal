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
    render
  };
})();
