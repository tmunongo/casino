import { createDeck, shuffleDeck, type Card, type Rank } from './cards';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GofishPlayer {
	id: string;
	name: string;
	hand: Card[];
	books: Rank[]; // ranks for which a book of 4 has been collected
}

export interface GofishState {
	deck: Card[];
	players: Record<string, GofishPlayer>;
	playerOrder: string[];
	currentPlayer: string;
	phase: 'waiting' | 'playing' | 'over';
	winner: string | null;
	turnCount: number;
	/** Feedback message shown in the UI (e.g. "Go Fish!", "Got 2 kings!") */
	pondMessage: string | null;
	/** The last rank that was asked for (used to validate drawFromPond) */
	lastAskedRank: Rank | null;
	/** true if the current player must draw from pond before asking again */
	mustDrawFromPond: boolean;
}

export type GofishMove =
	| { type: 'ask'; targetId: string; rank: Rank }
	| { type: 'drawFromPond' };

export type GofishMoveResult =
	| { ok: true; state: GofishState }
	| { ok: false; error: string };

const HAND_SIZE = 7; // for 2 players

// ─── State creation ───────────────────────────────────────────────────────────

export function createInitialGofishState(
	players: { id: string; name: string }[]
): GofishState {
	let deck = shuffleDeck(createDeck());

	const playerMap: Record<string, GofishPlayer> = {};
	const playerOrder = players.map((p) => p.id);

	for (const player of players) {
		playerMap[player.id] = {
			id: player.id,
			name: player.name,
			hand: deck.splice(0, HAND_SIZE),
			books: []
		};
	}

	// Collect any starting books
	for (const id of playerOrder) {
		const result = collectBooks(playerMap[id], deck);
		playerMap[id] = result.player;
		deck = result.deck;
	}

	return {
		deck,
		players: playerMap,
		playerOrder,
		currentPlayer: playerOrder[0],
		phase: 'playing',
		winner: null,
		turnCount: 0,
		pondMessage: null,
		lastAskedRank: null,
		mustDrawFromPond: false
	};
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Remove completed books from hand, return updated player + deck (books don't go back to deck). */
function collectBooks(
	player: GofishPlayer,
	deck: Card[]
): { player: GofishPlayer; deck: Card[] } {
	const rankCounts = new Map<Rank, Card[]>();
	for (const card of player.hand) {
		const group = rankCounts.get(card.rank) ?? [];
		group.push(card);
		rankCounts.set(card.rank, group);
	}

	const newBooks: Rank[] = [...player.books];
	let newHand = [...player.hand];

	for (const [rank, cards] of rankCounts) {
		if (cards.length === 4) {
			newBooks.push(rank);
			newHand = newHand.filter((c) => c.rank !== rank);
		}
	}

	return { player: { ...player, hand: newHand, books: newBooks }, deck };
}

function nextPlayer(state: GofishState): string {
	const idx = state.playerOrder.indexOf(state.currentPlayer);
	return state.playerOrder[(idx + 1) % state.playerOrder.length];
}

function countTotalBooks(state: GofishState): number {
	return Object.values(state.players).reduce((sum, p) => sum + p.books.length, 0);
}

function findWinner(state: GofishState): string | null {
	// Game ends when all 13 books have been won
	if (countTotalBooks(state) < 13) return null;
	// Winner is the player with the most books
	let best: string | null = null;
	let bestCount = -1;
	for (const player of Object.values(state.players)) {
		if (player.books.length > bestCount) {
			bestCount = player.books.length;
			best = player.id;
		}
	}
	return best;
}

// ─── Move application ─────────────────────────────────────────────────────────

export function applyGofishMove(
	state: GofishState,
	move: GofishMove,
	playerId: string
): GofishMoveResult {
	if (state.phase !== 'playing') return { ok: false, error: 'Game is not in progress' };
	if (state.currentPlayer !== playerId) return { ok: false, error: 'Not your turn' };

	// ── drawFromPond ──
	if (move.type === 'drawFromPond') {
		if (!state.mustDrawFromPond) return { ok: false, error: 'No need to draw right now' };
		if (state.deck.length === 0) {
			// No cards left — player loses their turn
			const eliminated = state.players[playerId].hand.length === 0;
			return {
				ok: true,
				state: {
					...state,
					pondMessage: eliminated ? 'Pond is empty — out of cards!' : 'Pond is empty!',
					mustDrawFromPond: false,
					lastAskedRank: null,
					currentPlayer: eliminated ? nextPlayer(state) : nextPlayer(state),
					turnCount: state.turnCount + 1
				}
			};
		}

		const [drawn, ...remainingDeck] = state.deck;
		let player = { ...state.players[playerId], hand: [...state.players[playerId].hand, drawn] };
		let deck = remainingDeck;

		// Collect any new book
		const collected = collectBooks(player, deck);
		player = collected.player;
		deck = collected.deck;

		const gotAsked = drawn.rank === state.lastAskedRank;
		const winner = findWinner({ ...state, players: { ...state.players, [playerId]: player }, deck });

		return {
			ok: true,
			state: {
				...state,
				deck,
				players: { ...state.players, [playerId]: player },
				pondMessage: gotAsked ? `Drew a ${drawn.rank}! Play again!` : `Go Fish! Drew ${drawn.rank}`,
				mustDrawFromPond: false,
				lastAskedRank: null,
				// If drew the rank they asked for, play again; otherwise pass
				currentPlayer: gotAsked || winner ? playerId : nextPlayer(state),
				phase: winner ? 'over' : 'playing',
				winner,
				turnCount: state.turnCount + 1
			}
		};
	}

	// ── ask ──
	if (move.type === 'ask') {
		if (state.mustDrawFromPond) return { ok: false, error: 'Must draw from pond first' };

		const asker = state.players[playerId];
		const target = state.players[move.targetId];

		if (!target) return { ok: false, error: 'Target player not found' };
		if (move.targetId === playerId) return { ok: false, error: 'Cannot ask yourself' };
		if (!asker.hand.some((c) => c.rank === move.rank)) {
			return { ok: false, error: 'You must hold at least one card of the rank you ask for' };
		}

		const given = target.hand.filter((c) => c.rank === move.rank);

		if (given.length === 0) {
			// Go Fish!
			return {
				ok: true,
				state: {
					...state,
					pondMessage: 'Go Fish!',
					lastAskedRank: move.rank,
					mustDrawFromPond: true
					// turn stays until they draw
				}
			};
		}

		// Transfer cards from target to asker
		const newTargetHand = target.hand.filter((c) => c.rank !== move.rank);
		let newAskerHand = [...asker.hand, ...given];

		let askerPlayer: GofishPlayer = { ...asker, hand: newAskerHand };
		const targetPlayer: GofishPlayer = { ...target, hand: newTargetHand };

		// Collect books for asker
		const collected = collectBooks(askerPlayer, state.deck);
		askerPlayer = collected.player;

		const newPlayers = {
			...state.players,
			[playerId]: askerPlayer,
			[move.targetId]: targetPlayer
		};

		const winner = findWinner({ ...state, players: newPlayers });
		const msg = `Got ${given.length} ${move.rank}${given.length > 1 ? 's' : ''}! Play again!`;

		return {
			ok: true,
			state: {
				...state,
				players: newPlayers,
				pondMessage: msg,
				lastAskedRank: null,
				mustDrawFromPond: false,
				// Successful ask → play again
				currentPlayer: winner ? playerId : playerId,
				phase: winner ? 'over' : 'playing',
				winner,
				turnCount: state.turnCount + 1
			}
		};
	}

	return { ok: false, error: 'Unknown move type' };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getOpponentId(state: GofishState, myId: string): string | undefined {
	return state.playerOrder.find((id) => id !== myId);
}

export function ranksInHand(hand: Card[]): Rank[] {
	return [...new Set(hand.map((c) => c.rank))];
}
