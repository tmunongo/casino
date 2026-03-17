export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
	id: string;
	suit: Suit;
	rank: Rank;
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣',
	spades: '♠'
};

export const SUIT_NAMES: Record<Suit, string> = {
	hearts: 'Hearts',
	diamonds: 'Diamonds',
	clubs: 'Clubs',
	spades: 'Spades'
};

export function createDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			deck.push({ id: `${rank}-${suit}`, suit, rank });
		}
	}
	return deck;
}

/** Fisher–Yates shuffle – returns a new array */
export function shuffleDeck(deck: Card[]): Card[] {
	const arr = [...deck];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export function isRed(card: Card): boolean {
	return card.suit === 'hearts' || card.suit === 'diamonds';
}

export function cardValue(card: Card): number {
	if (card.rank === '8') return 50;
	if (['J', 'Q', 'K'].includes(card.rank)) return 10;
	if (card.rank === 'A') return 1;
	return parseInt(card.rank);
}
