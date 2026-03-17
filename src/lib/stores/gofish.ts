import { writable, derived, get } from 'svelte/store';
import { GamePeer, type NetworkMessage } from '$lib/network/peer';
import {
	applyGofishMove,
	createInitialGofishState,
	getOpponentId,
	type GofishState,
	type GofishMove
} from '$lib/game/gofish';

// ─── Stores ───────────────────────────────────────────────────────────────────

export const gofishState = writable<GofishState | null>(null);
export const myGofishPlayerId = writable<string>('');
export const myGofishName = writable<string>('');
export const gofishOpponentId = writable<string | null>(null);
export const gofishOpponentName = writable<string | null>(null);
export const gofishIsHost = writable<boolean>(false);
export const gofishConnectionStatus = writable<
	'idle' | 'initializing' | 'waiting' | 'connected' | 'disconnected' | 'error'
>('idle');
export const gofishErrorMessage = writable<string | null>(null);

// ─── Derived ──────────────────────────────────────────────────────────────────

export const myGofishHand = derived([gofishState, myGofishPlayerId], ([$s, $id]) => {
	if (!$s || !$id) return [];
	return $s.players[$id]?.hand ?? [];
});

export const myGofishBooks = derived([gofishState, myGofishPlayerId], ([$s, $id]) => {
	if (!$s || !$id) return [];
	return $s.players[$id]?.books ?? [];
});

export const isMyGofishTurn = derived(
	[gofishState, myGofishPlayerId],
	([$s, $id]) => !!$s && $s.currentPlayer === $id && $s.phase === 'playing'
);

// ─── Session state ────────────────────────────────────────────────────────────

let peer: GamePeer | null = null;
let _isHost = false;

// ─── Setup ────────────────────────────────────────────────────────────────────

export function setupGofishHost(gameId: string, name: string): void {
	_isHost = true;
	gofishIsHost.set(true);
	myGofishPlayerId.set(gameId);
	myGofishName.set(name);
	gofishConnectionStatus.set('initializing');
	gofishErrorMessage.set(null);

	peer = new GamePeer({
		onPeerOpen: () => gofishConnectionStatus.set('waiting'),
		onConnect: (remotePeerId) => {
			gofishOpponentId.set(remotePeerId);
			gofishConnectionStatus.set('connected');
		},
		onMessage: handleMessage,
		onDisconnect: () => gofishConnectionStatus.set('disconnected'),
		onError: (err) => {
			gofishErrorMessage.set(err.message);
			gofishConnectionStatus.set('error');
		}
	});

	peer.init(gameId).catch((err) => {
		gofishErrorMessage.set(`Failed to initialise connection: ${err.message}`);
		gofishConnectionStatus.set('error');
	});
}

export function setupGofishJoiner(gameId: string, name: string): void {
	_isHost = false;
	gofishIsHost.set(false);
	myGofishName.set(name);
	gofishConnectionStatus.set('initializing');
	gofishErrorMessage.set(null);

	peer = new GamePeer({
		onPeerOpen: (id) => {
			myGofishPlayerId.set(id);
			peer?.connectTo(gameId);
			gofishConnectionStatus.set('waiting');
		},
		onConnect: (remotePeerId) => {
			gofishOpponentId.set(remotePeerId);
			gofishConnectionStatus.set('connected');
			peer?.send({ type: 'PLAYER_JOIN', name, playerId: get(myGofishPlayerId) });
		},
		onMessage: handleMessage,
		onDisconnect: () => gofishConnectionStatus.set('disconnected'),
		onError: (err) => {
			gofishErrorMessage.set(err.message);
			gofishConnectionStatus.set('error');
		}
	});

	peer.init().catch((err) => {
		gofishErrorMessage.set(`Failed to initialise connection: ${err.message}`);
		gofishConnectionStatus.set('error');
	});
}

// ─── Message handler ──────────────────────────────────────────────────────────

function handleMessage(msg: NetworkMessage, fromId: string): void {
	switch (msg.type) {
		case 'PLAYER_JOIN': {
			if (!_isHost) return;
			const hostId = get(myGofishPlayerId);
			const hostName = get(myGofishName);
			gofishOpponentName.set(msg.name);

			const state = createInitialGofishState([
				{ id: hostId, name: hostName },
				{ id: fromId, name: msg.name }
			]);

			gofishState.set(state);
			peer?.send({ type: 'GF_GAME_START', state });
			break;
		}

		case 'GF_GAME_START': {
			gofishState.set(msg.state);
			const myId = get(myGofishPlayerId);
			const oppId = getOpponentId(msg.state, myId);
			if (oppId) {
				gofishOpponentId.set(oppId);
				gofishOpponentName.set(msg.state.players[oppId]?.name ?? 'Opponent');
			}
			break;
		}

		case 'GF_MOVE': {
			if (!_isHost) return;
			const current = get(gofishState);
			if (!current) return;
			const result = applyGofishMove(current, msg.move, msg.playerId);
			if (result.ok) {
				gofishState.set(result.state);
				peer?.send({ type: 'GF_STATE_UPDATE', state: result.state });
			}
			break;
		}

		case 'GF_STATE_UPDATE': {
			gofishState.set(msg.state);
			break;
		}
	}
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function makeGofishMove(move: GofishMove): void {
	const state = get(gofishState);
	const myId = get(myGofishPlayerId);
	if (!state || !myId) return;

	if (_isHost) {
		const result = applyGofishMove(state, move, myId);
		if (result.ok) {
			gofishState.set(result.state);
			peer?.send({ type: 'GF_STATE_UPDATE', state: result.state });
		}
	} else {
		peer?.send({ type: 'GF_MOVE', move, playerId: myId });
	}
}

export function destroyGofishSession(): void {
	peer?.destroy();
	peer = null;
	gofishState.set(null);
	myGofishPlayerId.set('');
	myGofishName.set('');
	gofishOpponentId.set(null);
	gofishOpponentName.set(null);
	gofishConnectionStatus.set('idle');
	gofishErrorMessage.set(null);
}
