import { createDeck, shuffleDeck, cardValue, type Card, type Suit } from './cards';

export interface Player {
	id: string;
	name: string;
	hand: Card[];
}

export interface GameState {
	deck: Card[];
	discardPile: Card[];
	players: Record<string, Player>;
	playerOrder: string[];
	currentPlayer: string;
	declaredSuit: Suit | null;
	/** After drawing, this is the card just drawn (so UI can highlight it) */
	lastDrawnCardId: string | null;
	phase: 'waiting' | 'playing' | 'over';
	winner: string | null;
	turnCount: number;
}

export type Move =
	| { type: 'playCard'; cardId: string; declaredSuit?: Suit }
	| { type: 'drawCard' }
	| { type: 'pass' };

export type MoveResult = { ok: true; state: GameState } | { ok: false; error: string };

const HAND_SIZE = 7;

// ─── State creation ──────────────────────────────────────────────────────────

export function createInitialState(players: { id: string; name: string }[]): GameState {
	let deck = shuffleDeck(createDeck());

	const playerMap: Record<string, Player> = {};
	const playerOrder = players.map((p) => p.id);

	for (const player of players) {
		playerMap[player.id] = {
			id: player.id,
			name: player.name,
			hand: deck.splice(0, HAND_SIZE)
		};
	}

	// First discard card must not be an 8
	let startIdx = deck.findIndex((c) => c.rank !== '8');
	if (startIdx === -1) startIdx = 0;
	const [startCard] = deck.splice(startIdx, 1);

	return {
		deck,
		discardPile: [startCard],
		players: playerMap,
		playerOrder,
		currentPlayer: playerOrder[0],
		declaredSuit: null,
		lastDrawnCardId: null,
		phase: 'playing',
		winner: null,
		turnCount: 0
	};
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function topCard(state: GameState): Card {
	return state.discardPile[state.discardPile.length - 1];
}

export function isLegalPlay(card: Card, state: GameState): boolean {
	if (card.rank === '8') return true;
	const top = topCard(state);
	const effectiveSuit = state.declaredSuit ?? top.suit;
	return card.suit === effectiveSuit || card.rank === top.rank;
}

export function getLegalPlays(state: GameState, playerId: string): Card[] {
	const player = state.players[playerId];
	if (!player) return [];
	return player.hand.filter((card) => isLegalPlay(card, state));
}

export function canPlay(state: GameState, playerId: string): boolean {
	return getLegalPlays(state, playerId).length > 0;
}

export function getOpponentId(state: GameState, myId: string): string | undefined {
	return state.playerOrder.find((id) => id !== myId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextPlayer(state: GameState): string {
	const idx = state.playerOrder.indexOf(state.currentPlayer);
	return state.playerOrder[(idx + 1) % state.playerOrder.length];
}

function reshuffleIfNeeded(state: GameState): GameState {
	if (state.deck.length > 0) return state;
	if (state.discardPile.length <= 1) return state;

	// Keep top card, shuffle rest back into deck
	const top = state.discardPile[state.discardPile.length - 1];
	const rest = state.discardPile.slice(0, -1);
	return {
		...state,
		deck: shuffleDeck(rest),
		discardPile: [top],
		declaredSuit: null
	};
}

// ─── Move application ─────────────────────────────────────────────────────────

export function applyMove(state: GameState, move: Move, playerId: string): MoveResult {
	if (state.phase !== 'playing') return { ok: false, error: 'Game is not in progress' };
	if (state.currentPlayer !== playerId) return { ok: false, error: 'Not your turn' };

	// ── Play a card ──
	if (move.type === 'playCard') {
		const player = state.players[playerId];
		const cardIdx = player.hand.findIndex((c) => c.id === move.cardId);
		if (cardIdx === -1) return { ok: false, error: 'Card not in hand' };

		const card = player.hand[cardIdx];
		if (!isLegalPlay(card, state)) return { ok: false, error: 'Illegal play' };
		if (card.rank === '8' && !move.declaredSuit) {
			return { ok: false, error: 'Must declare suit when playing an 8' };
		}

		const newHand = player.hand.filter((_, i) => i !== cardIdx);
		const newDiscardPile = [...state.discardPile, card];
		const newDeclaredSuit = card.rank === '8' ? (move.declaredSuit ?? null) : null;
		const isWinner = newHand.length === 0;

		const playAgain = ['K', 'J', '7'].includes(card.rank);

		return {
			ok: true,
			state: {
				...state,
				discardPile: newDiscardPile,
				declaredSuit: newDeclaredSuit,
				lastDrawnCardId: null,
				players: {
					...state.players,
					[playerId]: { ...player, hand: newHand }
				},
				currentPlayer: isWinner || playAgain ? playerId : nextPlayer(state),
				phase: isWinner ? 'over' : 'playing',
				winner: isWinner ? playerId : null,
				turnCount: state.turnCount + 1
			}
		};
	}

	// ── Draw a card ──
	if (move.type === 'drawCard') {
		const working = reshuffleIfNeeded(state);
		if (working.deck.length === 0) return { ok: false, error: 'No cards left to draw' };

		const [drawn, ...remainingDeck] = working.deck;
		const player = working.players[playerId];

		return {
			ok: true,
			state: {
				...working,
				deck: remainingDeck,
				lastDrawnCardId: drawn.id,
				players: {
					...working.players,
					[playerId]: { ...player, hand: [...player.hand, drawn] }
				}
				// Turn stays with same player — they can now play or draw again
			}
		};
	}

	// ── Pass ──
	if (move.type === 'pass') {
		// Can only pass if deck is empty and no legal plays, OR if they already drew a card this turn.
		const working = reshuffleIfNeeded(state);
		const hasDrawn = state.lastDrawnCardId !== null;
		
		if (working.deck.length > 0 && !hasDrawn) return { ok: false, error: 'Must draw before passing' };
		if (canPlay(state, playerId)) return { ok: false, error: 'Must play if able' };

		return {
			ok: true,
			state: {
				...state,
				lastDrawnCardId: null,
				currentPlayer: nextPlayer(state),
				turnCount: state.turnCount + 1
			}
		};
	}

	return { ok: false, error: 'Unknown move type' };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function scoreHand(hand: Card[]): number {
	return hand.reduce((sum, card) => sum + cardValue(card), 0);
}
