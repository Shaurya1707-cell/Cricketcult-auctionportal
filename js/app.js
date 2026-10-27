/**
 * Main Application Orchestrator & View Switcher
 * Coordinates state subscriptions, tab routing, toast notifications and global events.
 */
window.AuctionApp = (function () {
  let activeView = 'auction';

  function init() {
    setupNavigation();
    setupSoundToggle();
    setupBackupControls();

    // Initialize sub-modules
    window.AuctionLive.init();
    window.AuctionPlayers.init();
    window.AuctionCaptain.init();
    window.AuctionAdmin.init();
    if (window.AuctionSync) window.AuctionSync.init();

    // Mobile touch audio unlock
    const unlockAudio = () => {
      if (window.AuctionSound) window.AuctionSound.playTick();
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { once: true });

    // Subscribe to state mutations
    window.AuctionState.subscribe((state) => {
      renderCurrentView();
      updateHeaderStatus(state);
    });

    // Initial render
    renderCurrentView();
    updateHeaderStatus(window.AuctionState.get());
  }

  function setupNavigation() {
    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-view-target]');
      if (tabBtn) {
        const target = tabBtn.dataset.viewTarget;
        navigateTo(target);
      }
    });
  }

  function navigateTo(viewName) {
    activeView = viewName;

    // Update Tab UI
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.viewTarget === viewName);
    });

    // Update Section Visibility
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `${viewName}View`);
    });

    renderCurrentView();
  }

  function renderCurrentView() {
    if (activeView === 'auction') {
      window.AuctionLive.renderAll();
    } else if (activeView === 'teams') {
      window.AuctionTeams.renderAll();
    } else if (activeView === 'players') {
      window.AuctionPlayers.renderPlayers();
    } else if (activeView === 'captain') {
      window.AuctionCaptain.render();
    } else if (activeView === 'admin') {
      window.AuctionAdmin.render();
    }
  }

  function updateHeaderStatus(state) {
    const dot = document.getElementById('headerStatusDot');
    const text = document.getElementById('headerStatusText');
    if (!dot || !text) return;

    if (!state.current) {
      dot.className = 'pulse-dot paused';
      dot.style.background = 'var(--text-muted)';
      text.textContent = 'AUCTION READY';
    } else if (state.current.paused) {
      dot.className = 'pulse-dot paused';
      dot.style.background = 'var(--accent-gold)';
      text.textContent = 'BIDDING PAUSED';
    } else {
      dot.className = 'pulse-dot';
      dot.style.background = 'var(--accent-lime)';
      text.textContent = 'LIVE BIDDING';
    }
  }

  function setupSoundToggle() {
    const btn = document.getElementById('soundToggleBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const enabled = window.AuctionSound.toggle();
      btn.classList.toggle('active', enabled);
      btn.innerHTML = enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      showToast(enabled ? 'Sound effects enabled' : 'Sound effects muted', 'info');
      if (enabled) window.AuctionSound.playBid();
    });
  }

  function setupBackupControls() {
    // Export State
    const exportBtn = document.getElementById('btnExportBackup');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = window.AuctionState.exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cricketcult_auction_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Auction data exported to JSON file', 'success');
      });
    }

    // Import State
    const importInput = document.getElementById('importBackupInput');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const success = window.AuctionState.importData(event.target.result);
          if (success) {
            showToast('Auction database restored from backup', 'success');
            renderCurrentView();
          } else {
            showToast('Failed to import: invalid JSON schema', 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    // Clear All Players
    const clearPlayersBtn = document.getElementById('btnClearAllPlayers');
    if (clearPlayersBtn) {
      clearPlayersBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all players? This will empty the auction pool and remove player rosters so you can enter your own players.')) {
          window.AuctionState.clearAllPlayers();
          showToast('Player pool completely cleared! Ready for your custom players.', 'success');
          renderCurrentView();
        }
      });
    }

    // Bulk Add Players
    const bulkAddBtn = document.getElementById('btnBulkImportPlayers');
    if (bulkAddBtn) {
      bulkAddBtn.addEventListener('click', () => {
        const textarea = document.getElementById('bulkPlayersInput');
        if (!textarea) return;
        const text = textarea.value.trim();
        if (!text) {
          showToast('Please paste or type player rows first', 'error');
          return;
        }

        const lines = text.split('\n');
        let addedCount = 0;
        const state = window.AuctionState.get();

        lines.forEach(line => {
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 1 && parts[0]) {
            const name = parts[0];
            const role = parts[1] || 'Batter';
            const base = parseInt(parts[2], 10) || 2000;
            const nation = parts[3] || 'India';

            if (!state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
              state.players.push({
                id: 'p_' + Date.now() + Math.random().toString(36).substr(2, 4),
                name,
                role: ['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'].includes(role) ? role : 'Batter',
                nation,
                matches: 0,
                runs: 0,
                wickets: 0,
                avg: '—',
                sr: '—',
                base,
                rating: '⭐⭐⭐⭐',
                badge: 'Custom',
                status: 'available'
              });
              addedCount++;
            }
          }
        });

        if (addedCount > 0) {
          window.AuctionState.logActivity(`Admin bulk added ${addedCount} custom players to the auction pool`);
          window.AuctionState.save();
          textarea.value = '';
          showToast(`Successfully added ${addedCount} custom players!`, 'success');
          renderCurrentView();
        } else {
          showToast('No new valid players found to add', 'error');
        }
      });
    }

    // Clear All Teams
    const clearTeamsBtn = document.getElementById('btnClearAllTeams');
    if (clearTeamsBtn) {
      clearTeamsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all franchises? This will remove all teams so you can register your own franchise names.')) {
          window.AuctionState.clearAllTeams();
          showToast('All franchises cleared! Ready to register your own teams.', 'success');
          renderCurrentView();
        }
      });
    }

    // Bulk Add Franchises
    const bulkTeamsBtn = document.getElementById('btnBulkImportTeams');
    if (bulkTeamsBtn) {
      bulkTeamsBtn.addEventListener('click', () => {
        const textarea = document.getElementById('bulkTeamsInput');
        if (!textarea) return;
        const text = textarea.value.trim();
        if (!text) {
          showToast('Please paste or type team rows first', 'error');
          return;
        }

        const lines = text.split('\n');
        let addedCount = 0;
        const state = window.AuctionState.get();

        lines.forEach(line => {
          const parts = line.split(',').map(s => s.trim());
          if (parts.length >= 1 && parts[0]) {
            const name = parts[0];
            const shortName = parts[1] || name.substring(0, 3).toUpperCase();
            const captain = parts[2] || 'Captain';
            const captainId = parts[3] || ('captain_' + shortName.toLowerCase());
            const password = parts[4] || (shortName.toLowerCase() + '@123');
            const budget = parseInt(parts[5], 10) || 100000;

            if (!state.teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
              state.teams.push({
                id: 't_' + Date.now() + Math.random().toString(36).substr(2, 4),
                name,
                shortName,
                captain,
                captainId,
                password,
                code: shortName + '24',
                budget,
                spent: 0,
                limit: 15,
                icon: '🛡️',
                players: []
              });
              addedCount++;
            }
          }
        });

        if (addedCount > 0) {
          window.AuctionState.logActivity(`Admin bulk registered ${addedCount} custom franchises`);
          window.AuctionState.save();
          textarea.value = '';
          showToast(`Successfully registered ${addedCount} custom franchises!`, 'success');
          renderCurrentView();
        } else {
          showToast('No new valid teams found to add', 'error');
        }
      });
    }

    // Reset Clean Data
    const resetBtn = document.getElementById('btnResetDemoData');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset auction back to clean initial state? This clears active bids and rosters.')) {
          window.AuctionState.resetToSeed();
          showToast('Auction reset to clean default state', 'info');
          renderCurrentView();
        }
      });
    }
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '📢';
    toast.innerHTML = `<span>${icon}</span> <span>${window.AuctionState.escapeHTML(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  return {
    init,
    navigateTo,
    showToast
  };
})();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.AuctionApp.init();
});
