/**
 * Default Seed Data for CricketCult Auction Portal
 * Initialized with empty teams and empty players - 100% clean slate for custom league creation.
 */
window.AuctionSeed = {
  teams: [], // Cleared: ready for user to add custom franchise teams

  players: [], // Cleared: ready for user to add custom players

  current: null,
  history: [],
  activity: [
    { text: 'Auction Portal initialized with a clean slate. Ready to register franchises and players.', time: Date.now() }
  ],
  nextId: 1
};
