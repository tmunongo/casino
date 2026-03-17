# Crazy Eights — Serverless P2P Card Game

A two-player Crazy Eights card game built with **SvelteKit** and **PeerJS** (WebRTC).  
No backend, no database — game state lives in the browser and syncs peer-to-peer.

---

## Features

- **Peer-to-peer multiplayer** via WebRTC data channels (PeerJS)
- **Host-authoritative** game state — the host validates every move, prevents cheating
- **Full Crazy Eights rules** — suit/rank matching, wild 8s with suit declaration, draw-until-playable
- **Shareable invite link** — one click to copy, opponent opens the URL and joins
- **Post-game summary** — winner, hand scores, play again option
- **Casino felt aesthetic** — Cinzel + Crimson Pro fonts, gold accents, animated card interactions

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit (adapter-auto) |
| P2P Networking | PeerJS (WebRTC data channels) |
| State | Svelte stores (writable/derived) |
| Persistence | `localStorage` (nickname, game history) |
| Styling | Scoped Svelte CSS + CSS custom properties |

---

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## How to Play

1. **Player 1** opens the app, enters their name, clicks **New Game**
2. The lobby page shows a shareable URL — copy it
3. **Player 2** opens the link, enters their name, clicks **Join**
4. The game starts automatically once both players are connected

### Rules
- Match the **suit** or **rank** of the top discard card
- **Eights are wild** — play on anything, then declare the new suit
- If you can't play, **draw** a card from the stock
- If the stock is empty and you still can't play, **pass**
- First player to empty their hand wins
- Scores = total card values remaining in the loser's hand (8 = 50pts, face cards = 10pts)

---

## Architecture

```
src/
├── lib/
│   ├── game/
│   │   ├── cards.ts        # Card types, deck creation, Fisher-Yates shuffle
│   │   └── rules.ts        # Pure deterministic rules engine (applyMove, isLegalPlay…)
│   ├── network/
│   │   └── peer.ts         # PeerJS wrapper with typed NetworkMessage protocol
│   ├── stores/
│   │   └── game.ts         # Svelte stores + host/joiner setup + move dispatch
│   └── components/
│       ├── PlayingCard.svelte   # Card face-up/face-down with playable highlight
│       └── SuitPicker.svelte   # Overlay for choosing suit after playing an 8
└── routes/
    ├── +page.svelte            # Landing page (create/join game)
    ├── game/[id]/+page.svelte  # Game table (WebRTC, hands, actions)
    └── postgame/[id]/+page.svelte  # Results screen
```

### Sync model

```
Host browser                     Joiner browser
──────────────────────────────────────────────────
creates game state
broadcasts GAME_START ──────────► receives GAME_START, sets local state

                     ◄─────────── sends MOVE (playCard / drawCard / pass)
validates move
applies to local state
broadcasts STATE_UPDATE ────────► applies STATE_UPDATE blindly
```

The host is the single source of truth. The joiner never modifies state directly — it only suggests moves that the host validates and echoes back as authoritative state patches.

---

## Extending

The architecture is designed for easy expansion:

### Add a new game (e.g. Snap, Go Fish)

```
src/lib/games/
├── crazyEights/
│   ├── rules.ts        # applyMove, initialState, isGameOver
│   └── ui/             # game-specific Svelte components
└── goFish/
    ├── rules.ts
    └── ui/
```

Each rules module exports the same interface:
```ts
export function createInitialState(players): GameState
export function applyMove(state, move, playerId): MoveResult
export function isGameOver(state): boolean
```

The network, lobby, and store layers are game-agnostic.

### Add persistence
Replace `localStorage` calls with a KV store (Cloudflare Workers KV, Supabase, etc.) when you want cross-device game history.

### Add a signaling server
PeerJS defaults to their free public broker for WebRTC signaling. For production, self-host [`peer-server`](https://github.com/peers/peerjs-server):
```bash
npx peer-server --port 9000
```
Then point PeerJS at it:
```ts
new Peer(id, { host: 'your-server.com', port: 9000 })
```

---

## Deployment

```bash
npm run build
```

Deploy the `build/` output to any static host (Vercel, Netlify, Cloudflare Pages).  
SvelteKit's `adapter-auto` will detect the environment automatically.
