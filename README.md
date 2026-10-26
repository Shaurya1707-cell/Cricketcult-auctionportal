# CricketCult Auction Portal 🏏

> **Premier Cricket League Live Auction Room & Franchise Team Builder**

CricketCult Auction Portal is a live cricket franchise bidding application designed for local tournaments, college leagues, club championships, and corporate cricket leagues. It features real-time bidding paddles, dynamic countdown timers with gavel sound effects, purse tracking, player scouting catalogs, captain logins, and complete CSV report exports.

---

## 🌟 Key Features

### 🔴 1. Live Auction Arena
- **Marquee Player Podium**: Displays batsman/bowler stats (runs, wickets, averages, strike rates), rating stars, base prices, and active leaderboards.
- **Dynamic Gavel Countdown**: *"Going once... Going twice... Hammer Down!"* timer progress meter.
- **Real-Time Paddle Bidding**: Quick increment buttons (`+₹100`, `+₹500`, `+₹1,000`, `+₹5,000`) with purse validation and squad capacity checks.
- **Web Audio Sound Effects**: Procedural synthesized sound FX for bids, timer ticks, hammer strikes, and victory fanfares (zero external audio files needed).
- **Celebration Confetti**: Dynamic canvas particle confetti burst on confirmed sales.
- **Live Activity Ticker**: Timestamped real-time bid log and audit trail.

### 🛡️ 2. Franchise & Squad Management
- **Visual Purse Meters**: Live progress bars tracking remaining vs. spent credits.
- **Roster Inspector**: See all acquired players, roles, and purchase prices.
- **Official Sold Register**: Verified log of all confirmed purchases with base prices and price hike percentages.
- **CSV Data Exports**:
  - `📊 Export All Teams & Purchases (CSV)`
  - `📋 Export Sold Register (CSV)`
  - `📥 Single Team Squad CSV`

### 📋 3. Player Pool Catalog
- **Multi-Role Filtering**: Filter instantly across Batters, Bowlers, All-rounders, Keepers, Available, and Sold.
- **Instant Search**: Search by cricketer name, bowling style, or country.
- **Dual View Modes**: Switch between responsive Player Cards and Data Table views.

### ⚡ 4. Captain's Room
- **Confidential Authentication**: Private Franchise Captain ID and Password login.
- **Max Affordable Bid Advisor**: Automatically calculates the maximum safe bid a captain can make while reserving minimum base purse for remaining unfilled squad slots.
- **Dedicated Franchise Paddle**: Glowing `👑 YOUR TEAM` badge with single-click bidding for authorized captains.
- **Squad Export**: Download individual team squad rosters as CSV.

### 🔒 5. Admin Control Room
- **PIN-Protected Security**: Secure console to manage auction lifecycle.
- **Podium Orchestration**: Bring any player under the hammer, pause bidding, resume bidding, hammer down as SOLD, or mark UNSOLD.
- **Custom Player Entry**: Form to register single players or quick bulk-paste multiple cricketers (`Name, Role, BasePrice, Country`).
- **Custom Franchise Registration**: Form to create teams with custom budgets, squad limits, Captain IDs, and passwords.
- **Purse Adjustments**: Inject or adjust franchise credits with memo audit notes.
- **Data Management**: Export/Import complete JSON database backups or wipe/clear rosters with single-click purge buttons.

---

## 📁 Project Architecture

```
Cricketcult-auctionportal/
├── index.html                  # Semantic entry point and UI views
├── .gitignore                  # Git ignore rules
├── README.md                   # Documentation
├── data/
│   └── seed.js                 # Initial state structure and schema
├── css/
│   ├── variables.css           # Design tokens, gradients, neon accents & typography
│   ├── base.css                # Global layouts, header, tab navigation & animations
│   ├── components.css          # Cards, buttons, modals, toasts, tables & progress bars
│   ├── auction.css             # Live bidding podium, paddle grid & countdown timer
│   ├── teams.css               # Franchise squad cards, purse meters & roster lists
│   ├── players.css             # Player pool catalog, search, and category filters
│   └── admin.css               # Admin PIN lock screen, forms & orchestrator controls
└── js/
    ├── sound.js                # Web Audio API sound synthesizer
    ├── confetti.js             # Canvas particle confetti celebration
    ├── state.js                # Centralized state management with LocalStorage sync
    ├── auction.js              # Live auction engine & paddle bidding
    ├── teams.js                # Franchise squad management & CSV export engine
    ├── players.js              # Player catalog search & category filters
    ├── captain.js              # Captain's console with bid advisor
    ├── admin.js                # Admin PIN verification & orchestrator
    └── app.js                  # Main app bootstrap & routing
```

---

## 🚀 Getting Started

No build step or dependencies required!

1. Clone the repository:
   ```bash
   git clone https://github.com/Shaurya1707-cell/Cricketcult-auctionportal.git
   ```
2. Open `index.html` directly in any web browser, or serve with any static server:
   ```bash
   # Optional: using Python
   python -m http.server 8000
   
   # Or using npx serve
   npx serve .
   ```
3. Open `http://localhost:8000` (or double-click `index.html`).

---

## 📄 License
MIT License. Built for cricket enthusiasts and tournament organizers.
