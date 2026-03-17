import { writable, derived, get } from 'svelte/store';
import { GamePeer, type NetworkMessage } from '$lib/network/peer';
import { applyMove, createInitialState, getOpponentId, type GameState, type Move } from '$lib/game/rules';

// ─── Stores ───────────────────────────────────────────────────────────────────

export const gameState = writable<GameState | null>(null);
export const myPlayerId = writable<string>('');
export const myName = writable<string>('');
export const opponentId = writable<string | null>(null);
export const opponentName = writable<string | null>(null);
export const isHost = writable<boolean>(false);
export const connectionStatus = writable<
	'idle' | 'initializing' | 'waiting' | 'connected' | 'disconnected' | 'error'
>('idle');
export const errorMessage = writable<string | null>(null);

// ─── Derived ──────────────────────────────────────────────────────────────────

export const myHand = derived([gameState, myPlayerId], ([$s, $id]) => {
	if (!$s || !$id) return [];
	return $s.players[$id]?.hand ?? [];
});

export const isMyTurn = derived(
	[gameState, myPlayerId],
	([$s, $id]) => !!$s && $s.currentPlayer === $id && $s.phase === 'playing'
);

export const topDiscard = derived(gameState, ($s) => {
	if (!$s || $s.discardPile.length === 0) return null;
	return $s.discardPile[$s.discardPile.length - 1];
});

// ─── Session state (module-level, not reactive) ───────────────────────────────

let peer: GamePeer | null = null;
let _isHost = false;

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupHost(gameId: string, name: string): void {
	_isHost = true;
	isHost.set(true);
	myPlayerId.set(gameId); // host uses game ID as peer ID
	myName.set(name);
	connectionStatus.set('initializing');
	errorMessage.set(null);

	peer = new GamePeer({
		onPeerOpen: () => connectionStatus.set('waiting'),
		onConnect: (remotePeerId) => {
			opponentId.set(remotePeerId);
			connectionStatus.set('connected');
			// Host waits for PLAYER_JOIN from joiner
		},
		onMessage: handleMessage,
		onDisconnect: () => connectionStatus.set('disconnected'),
		onError: (err) => {
			errorMessage.set(err.message);
			connectionStatus.set('error');
		}
	});

	peer.init(gameId).catch((err) => {
		errorMessage.set(`Failed to initialise connection: ${err.message}`);
		connectionStatus.set('error');
	});
}

export function setupJoiner(gameId: string, name: string): void {
	_isHost = false;
	isHost.set(false);
	myName.set(name);
	connectionStatus.set('initializing');
	errorMessage.set(null);

	peer = new GamePeer({
		onPeerOpen: (id) => {
			myPlayerId.set(id);
			// Now connect to host; send PLAYER_JOIN once connection opens
			peer?.connectTo(gameId);
			connectionStatus.set('waiting');
		},
		onConnect: (remotePeerId) => {
			opponentId.set(remotePeerId);
			connectionStatus.set('connected');
			// Send our identity to the host
			peer?.send({ type: 'PLAYER_JOIN', name, playerId: get(myPlayerId) });
		},
		onMessage: handleMessage,
		onDisconnect: () => connectionStatus.set('disconnected'),
		onError: (err) => {
			errorMessage.set(err.message);
			connectionStatus.set('error');
		}
	});

	peer.init().catch((err) => {
		errorMessage.set(`Failed to initialise connection: ${err.message}`);
		connectionStatus.set('error');
	});
}

// ─── Message handler ──────────────────────────────────────────────────────────

function handleMessage(msg: NetworkMessage, fromId: string): void {
	switch (msg.type) {
		// Host receives joiner's identity → creates game → broadcasts initial state
		case 'PLAYER_JOIN': {
			if (!_isHost) return;
			const hostId = get(myPlayerId);
			const hostName = get(myName);
			opponentName.set(msg.name);

			const state = createInitialState([
				{ id: hostId, name: hostName },
				{ id: fromId, name: msg.name }
			]);

			gameState.set(state);
			peer?.send({ type: 'GAME_START', state });
			break;
		}

		// Joiner receives initial state from host
		case 'GAME_START': {
			gameState.set(msg.state);
			const myId = get(myPlayerId);
			const oppId = getOpponentId(msg.state, myId);
			if (oppId) {
				opponentId.set(oppId);
				opponentName.set(msg.state.players[oppId]?.name ?? 'Opponent');
			}
			break;
		}

		// Host receives a move from joiner → validate → apply → broadcast
		case 'MOVE': {
			if (!_isHost) return;
			const current = get(gameState);
			if (!current) return;
			const result = applyMove(current, msg.move, msg.playerId);
			if (result.ok) {
				gameState.set(result.state);
				peer?.send({ type: 'STATE_UPDATE', state: result.state });
			}
			break;
		}

		// Joiner receives authoritative state from host
		case 'STATE_UPDATE': {
			gameState.set(msg.state);
			break;
		}
	}
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function makeMove(move: Move): void {
	const state = get(gameState);
	const myId = get(myPlayerId);
	if (!state || !myId) return;

	if (_isHost) {
		// Host applies locally, then broadcasts
		const result = applyMove(state, move, myId);
		if (result.ok) {
			gameState.set(result.state);
			peer?.send({ type: 'STATE_UPDATE', state: result.state });
		}
	} else {
		// Joiner forwards to host for validation
		peer?.send({ type: 'MOVE', move, playerId: myId });
	}
}

export function destroySession(): void {
	peer?.destroy();
	peer = null;
	gameState.set(null);
	myPlayerId.set('');
	myName.set('');
	opponentId.set(null);
	opponentName.set(null);
	connectionStatus.set('idle');
	errorMessage.set(null);
}
