<script lang="ts">
	import type { Suit } from '$lib/game/cards';
	import { SUIT_SYMBOLS, SUIT_NAMES } from '$lib/game/cards';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{ pick: Suit }>();

	const SUITS: { suit: Suit; color: string }[] = [
		{ suit: 'hearts', color: '#c0392b' },
		{ suit: 'diamonds', color: '#c0392b' },
		{ suit: 'clubs', color: '#e8e0d0' },
		{ suit: 'spades', color: '#e8e0d0' }
	];
</script>

<div class="overlay" role="dialog" aria-label="Choose a suit">
	<div class="panel">
		<p class="prompt">You played an Eight — choose a suit</p>
		<div class="grid">
			{#each SUITS as { suit, color }}
				<button class="suit-btn" style="--suit-color: {color}" on:click={() => dispatch('pick', suit)}>
					<span class="sym">{SUIT_SYMBOLS[suit]}</span>
					<span class="lbl">{SUIT_NAMES[suit]}</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(4, 8, 18, 0.8);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.panel {
		background: #101c2c;
		border: 1px solid var(--gold);
		border-radius: 14px;
		padding: 2rem 2.5rem;
		text-align: center;
		box-shadow:
			0 0 0 1px rgba(201, 168, 76, 0.2),
			0 0 60px rgba(201, 168, 76, 0.2),
			0 20px 60px rgba(0, 0, 0, 0.6);
		animation: rise 0.2s ease;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: scale(0.9) translateY(10px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.prompt {
		font-family: var(--font-display);
		color: var(--gold);
		font-size: 0.9rem;
		letter-spacing: 0.08em;
		margin: 0 0 1.5rem;
		text-transform: uppercase;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.suit-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 1rem 1.4rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(201, 168, 76, 0.2);
		border-radius: 10px;
		cursor: pointer;
		color: var(--suit-color);
		transition:
			border-color 0.12s,
			background 0.12s,
			transform 0.12s;
	}

	.suit-btn:hover {
		border-color: var(--gold);
		background: rgba(201, 168, 76, 0.08);
		transform: scale(1.06);
	}

	.sym {
		font-size: 2.2rem;
		line-height: 1;
	}

	.lbl {
		font-family: var(--font-display);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-secondary);
	}
</style>
