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
- **Individual Franchise Deletion**: Delete single franchises one at a time with automatic roster safety guards that return any signed players on the team back into the available auction pool.
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
- **Self-Service Password Management**: Franchise captains can update their confidential login password directly from their authenticated dashboard.
- **Max Affordable Bid Advisor**: Automatically calculates the maximum safe bid a captain can make while reserving minimum base purse for remaining unfilled squad slots.
- **Dedicated Franchise Paddle**: Glowing `👑 YOUR TEAM` badge with single-click bidding for authorized captains.
- **Squad Export**: Download individual team squad rosters as CSV.

### 🔒 5. Admin Control Room
- **PIN-Protected Security**: Secure console to manage auction lifecycle.
- **Podium Orchestration**: Bring any player under the hammer, pause bidding, resume bidding, hammer down as SOLD, or mark UNSOLD.
- **Custom Player Entry**: Form to register single players or quick bulk-paste multiple cricketers (`Name, Role, BasePrice, Country`).
- **Custom Franchise Registration**: Form to create teams with custom budgets, squad limits, Captain IDs, and passwords.
- **Franchise Passwords & Security Management**: Full credential administration suite to update passwords, auto-generate memorable credentials, mask/reveal all passwords, and quick-edit credentials inline.
- **Single & Bulk Franchise Deletion**: Delete one franchise at a time with confirmation alerts and roster safeguards, or wipe all teams cleanly.
- **Purse Adjustments**: Inject or adjust franchise credits with memo audit notes.
- **Squad Size & Capacity Management**: Edit and adjust maximum player limits for individual teams or apply league-wide squad caps across all franchises simultaneously, complete with quick presets (11, 15, 18, 20, 25), inline steppers, and roster safety guards.
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

## 🚀 Getting Started (Multi-Device Live Sync)

### 📱 Option 1: Live Wi-Fi Sync (PC + Phones on Local Network) — **Recommended!**
Run the built-in zero-dependency sync server:
```bash
npm start
# or: node server.js
```
The server will print:
```
💻 PC / Auctioneer:    http://localhost:3000
📱 Phone / Wi-Fi:      http://192.168.x.x:3000
```
- Open `http://localhost:3000` on your PC.
- Open the Wi-Fi link on any phone (or click the **"📱 Sync Devices"** button on the PC to scan the QR Code directly with your phone camera!).
- Any change made on the PC (introducing players, hammer down, adding franchises) and any bid placed from a phone will reflect across all devices in real-time!

---

### ☁️ Option 2: Cloud Sync (GitHub Pages / Internet)
If hosting on GitHub Pages, Vercel, or accessing over cellular 4G/5G:
1. Open the website on your PC.
2. Click **"📱 Sync Devices"** in the top header.
3. Click **"📋 Copy Link"** or scan the QR Code with your phone.
4. Both devices connect to the same Room Code (e.g. `?room=CULT26`) via Cloud Relay with instant real-time synchronization.

---

## 📱 Mobile Phone Features
- **Native Bottom Navigation Bar**: Swift 1-tap switching between Auction Arena, Teams, Player Pool, Captain's Room, and Admin Console.
- **Dedicated Floating Captain Paddle**: When a team captain logs in on their phone, a glowing paddle stays pinned at the bottom for instant bidding.
- **QR Code Auto-Connect**: Scan the PC screen with your phone camera to join the auction room in seconds.
- **Responsive Player Podium**: Compact high-contrast display with countdown progress, mini-stats, and touch-friendly bid chips.

---

## 📄 License
MIT License. Built for cricket enthusiasts and tournament organizers.
