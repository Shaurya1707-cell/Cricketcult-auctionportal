/**
 * Central State Store & Persistence Layer
 * Provides reactive event publishing, LocalStorage sync and data manipulation.
 */
window.AuctionState = (function () {
  const STORAGE_KEY = 'cricketcult-auction-v4';
  
  // Clean up any stale old versions so old mock teams and players don't persist
  try {
    localStorage.removeItem('cricketcult-auction-v3');
    localStorage.removeItem('cricketcult-auction-v2');
    localStorage.removeItem('cricketcult-auction-v1');
    localStorage.removeItem('boundary-auction-v1');
    sessionStorage.removeItem('auction_logged_captain_id');
  } catch (e) {}

  let state = load();
  let listeners = [];
  let adminUnlocked = false;

  let loggedInCaptainTeamId = sessionStorage.getItem('auction_logged_captain_id') || null;

  function load() {
    let loadedState = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        loadedState = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved state, using seed:', e);
    }
    if (!loadedState) {
      loadedState = structuredClone(window.AuctionSeed);
    }
    // Ensure every team has captainId and password
    if (loadedState && Array.isArray(loadedState.teams)) {
      loadedState.teams.forEach(t => {
        if (!t.captainId) {
          t.captainId = 'captain_' + (t.shortName || t.name.substring(0, 3)).toLowerCase();
        }
        if (!t.password) {
          t.password = (t.shortName || t.name.substring(0, 3)).toLowerCase() + '@123';
        }
        if (!t.limit || isNaN(t.limit) || t.limit < 1) {
          t.limit = 15;
        }
      });
    }
    return loadedState;
  }

  function save(skipBroadcast = false) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
    notifyListeners();
    if (!skipBroadcast && window.AuctionSync && typeof window.AuctionSync.broadcastState === 'function') {
      window.AuctionSync.broadcastState(state);
    }
  }

  function applyRemoteState(incoming) {
    if (!incoming || !Array.isArray(incoming.teams)) return;
    state = incoming;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
    notifyListeners();
  }

  function notifyListeners() {
    listeners.forEach(fn => {
      try {
        fn(state);
      } catch (err) {
        console.error('Error in state subscriber:', err);
      }
    });
  }

  return {
    get() {
      return state;
    },

    subscribe(listener) {
      if (typeof listener === 'function') {
        listeners.push(listener);
      }
    },

    save,

    isAdminUnlocked() {
      return adminUnlocked;
    },

    setAdminUnlocked(val) {
      adminUnlocked = !!val;
      notifyListeners();
    },

    getLoggedInCaptain() {
      if (!loggedInCaptainTeamId) {
        loggedInCaptainTeamId = sessionStorage.getItem('auction_logged_captain_id') || null;
      }
      return loggedInCaptainTeamId ? this.getTeam(loggedInCaptainTeamId) : null;
    },

    loginCaptain(usernameOrCode, password) {
      const q = String(usernameOrCode || '').trim().toLowerCase();
      const pass = String(password || '').trim();

      const team = state.teams.find(t => 
        (t.captainId && t.captainId.toLowerCase() === q) ||
        (t.code && t.code.toLowerCase() === q) ||
        (t.shortName && t.shortName.toLowerCase() === q)
      );

      if (team && team.password === pass) {
        loggedInCaptainTeamId = team.id;
        sessionStorage.setItem('auction_logged_captain_id', team.id);
        notifyListeners();
        return { success: true, team };
      }
      return { success: false, reason: 'Invalid Captain ID / Team Code or Password' };
    },

    logoutCaptain() {
      loggedInCaptainTeamId = null;
      sessionStorage.removeItem('auction_logged_captain_id');
      notifyListeners();
    },

    updateTeamPassword(teamId, newPassword) {
      const team = state.teams.find(t => t.id === teamId);
      if (!team) return { success: false, reason: 'Franchise not found' };

      const pass = String(newPassword || '').trim();
      if (!pass || pass.length < 3) {
        return { success: false, reason: 'Password must be at least 3 characters long' };
      }

      team.password = pass;

      this.logActivity(`Captain password updated for franchise: ${team.name}`);
      save();

      if (window.AuctionSync && typeof window.AuctionSync.broadcastAction === 'function') {
        window.AuctionSync.broadcastAction('PASSWORD_UPDATED', { teamId, teamName: team.name }, state);
      }

      return { success: true, team };
    },

    getTeam(id) {
      return state.teams.find(t => t.id === id);
    },

    getPlayer(id) {
      return state.players.find(p => p.id === id);
    },

    logActivity(text) {
      state.activity.unshift({
        id: 'act_' + Date.now() + Math.random().toString(36).substr(2, 4),
        text,
        time: Date.now()
      });
      // Keep last 40 logs
      state.activity = state.activity.slice(0, 40);
      save();
    },

    formatMoney(amount) {
      return '₹' + Number(amount || 0).toLocaleString('en-IN');
    },

    escapeHTML(str) {
      return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));
    },

    clearAllPlayers() {
      state.players = [];
      state.current = null;
      state.history = [];
      state.teams.forEach(t => {
        t.players = [];
        t.spent = 0;
      });
      save();
      this.logActivity('All players cleared from pool. Ready for custom player entry.');
    },

    deleteTeam(teamId) {
      const teamIndex = state.teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) return { success: false, reason: 'Team not found' };

      const team = state.teams[teamIndex];

      // 1. Release all players signed to this franchise back to the available pool
      let releasedCount = 0;
      state.players.forEach(p => {
        if (p.soldTo === teamId) {
          p.status = 'available';
          delete p.soldTo;
          delete p.soldPrice;
          releasedCount++;
        }
      });

      // 2. Remove team from purchase history
      state.history = state.history.filter(h => h.teamId !== teamId);

      // 3. Handle live auction if currently active and referencing this team
      if (state.current) {
        if (state.current.highestTeamId === teamId) {
          if (Array.isArray(state.current.bids)) {
            state.current.bids = state.current.bids.filter(b => b.teamId !== teamId);
            if (state.current.bids.length > 0) {
              const prevBid = state.current.bids[state.current.bids.length - 1];
              state.current.highestTeamId = prevBid.teamId;
              state.current.highestTeamName = prevBid.teamName;
              state.current.bid = prevBid.amount;
            } else {
              state.current.highestTeamId = null;
              state.current.highestTeamName = null;
              state.current.bid = state.current.base;
            }
          } else {
            state.current.highestTeamId = null;
            state.current.highestTeamName = null;
            state.current.bid = state.current.base;
          }
        } else if (Array.isArray(state.current.bids)) {
          state.current.bids = state.current.bids.filter(b => b.teamId !== teamId);
        }
      }

      // 4. Log out if logged in captain is this team
      if (loggedInCaptainTeamId === teamId) {
        loggedInCaptainTeamId = null;
        try { sessionStorage.removeItem('auction_logged_captain_id'); } catch (e) {}
      }

      // 5. Remove team from array
      state.teams.splice(teamIndex, 1);

      // 6. Log activity
      let note = `Franchise deleted: ${team.name}`;
      if (releasedCount > 0) {
        note += ` (${releasedCount} player(s) returned to available pool)`;
      }
      this.logActivity(note);

      // 7. Save state & broadcast
      save();

      if (window.AuctionSync && typeof window.AuctionSync.broadcastAction === 'function') {
        window.AuctionSync.broadcastAction('TEAM_DELETED', { teamId, teamName: team.name, releasedCount }, state);
      }

      return { success: true, team, releasedCount };
    },

    clearAllTeams() {
      // Revert any sold players to available pool
      state.players.forEach(p => {
        if (p.soldTo) {
          p.status = 'available';
          delete p.soldTo;
          delete p.soldPrice;
        }
      });
      state.teams = [];
      state.current = null;
      state.history = [];
      loggedInCaptainTeamId = null;
      try { sessionStorage.removeItem('auction_logged_captain_id'); } catch (e) {}
      save();
      this.logActivity('All franchises cleared. Ready for custom team registration.');
    },

    resetToSeed() {
      state = structuredClone(window.AuctionSeed);
      save();
      this.logActivity('Auction reset to factory default teams and players');
    },

    exportData() {
      return JSON.stringify(state, null, 2);
    },

    importData(jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.teams && parsed.players) {
          state = parsed;
          save();
          return true;
        }
      } catch (e) {
        console.error('Invalid import JSON:', e);
      }
      return false;
    },

    applyRemoteState
  };
})();
