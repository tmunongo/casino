<script lang="ts">
	import type { Card } from '$lib/game/cards';
	import { SUIT_SYMBOLS, isRed } from '$lib/game/cards';
	import { createEventDispatcher } from 'svelte';

	export let card: Card;
	export let faceUp = true;
	export let playable = false;
	export let highlighted = false; // freshly drawn card
	export let size: 'sm' | 'md' | 'lg' = 'md';

	const dispatch = createEventDispatcher<{ click: Card }>();

	function onClick() {
		if (faceUp && playable) dispatch('click', card);
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="card card-{size}"
	class:face-up={faceUp}
	class:face-down={!faceUp}
	class:playable
	class:highlighted
	class:red={faceUp && isRed(card)}
	on:click={onClick}
	role={playable ? 'button' : undefined}
	aria-label={faceUp ? `${card.rank} of ${card.suit}` : 'Card back'}
	title={faceUp ? `${card.rank} of ${card.suit}` : undefined}
>
	{#if faceUp}
		<span class="corner top-left">
			<span class="rank">{card.rank}</span>
			<span class="suit-sym">{SUIT_SYMBOLS[card.suit]}</span>
		</span>
		<span class="center-sym">{SUIT_SYMBOLS[card.suit]}</span>
		<span class="corner bottom-right">
			<span class="rank">{card.rank}</span>
			<span class="suit-sym">{SUIT_SYMBOLS[card.suit]}</span>
		</span>
	{:else}
		<span class="back-inner"></span>
	{/if}
</div>

<style>
	.card {
		position: relative;
		border-radius: var(--radius-card);
		border: 1px solid rgba(0, 0, 0, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
		box-shadow: 2px 3px 8px rgba(0, 0, 0, 0.4);
		flex-shrink: 0;
	}

	.card-sm {
		width: 48px;
		height: 68px;
		font-size: 10px;
	}
	.card-md {
		width: 68px;
		height: 98px;
		font-size: 13px;
	}
	.card-lg {
		width: 90px;
		height: 128px;
		font-size: 17px;
	}

	/* Face-up */
	.face-up {
		background: #fefef8;
		color: #1a1a2e;
		cursor: default;
	}
	.face-up.red {
		color: var(--card-red);
	}

	/* Face-down */
	.face-down {
		background: linear-gradient(145deg, #1a2a6c 0%, #2c1a5e 50%, #1a2a6c 100%);
		border: 2px solid rgba(201, 168, 76, 0.5);
	}
	.back-inner {
		position: absolute;
		inset: 5px;
		border: 1px solid rgba(201, 168, 76, 0.3);
		border-radius: 4px;
		background: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 4px,
			rgba(201, 168, 76, 0.08) 4px,
			rgba(201, 168, 76, 0.08) 8px
		);
	}

	/* Corners */
	.corner {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
		gap: 1px;
		font-weight: 700;
	}
	.top-left {
		top: 4px;
		left: 5px;
	}
	.bottom-right {
		bottom: 4px;
		right: 5px;
		transform: rotate(180deg);
	}

	.center-sym {
		font-size: 1.85em;
		line-height: 1;
	}
	.card-sm .center-sym {
		font-size: 1.6em;
	}

	/* Playable */
	.playable {
		cursor: pointer;
		border-color: var(--gold);
		box-shadow:
			0 0 0 1px var(--gold),
			0 0 14px rgba(201, 168, 76, 0.45),
			2px 3px 8px rgba(0, 0, 0, 0.4);
	}
	.playable:hover {
		transform: translateY(-10px) scale(1.04);
		box-shadow:
			0 0 0 1px var(--gold-light),
			0 0 22px rgba(201, 168, 76, 0.6),
			4px 12px 20px rgba(0, 0, 0, 0.4);
	}

	/* Highlighted (just drawn) */
	.highlighted {
		box-shadow:
			0 0 0 2px #60c0a0,
			0 0 16px rgba(96, 192, 160, 0.4),
			2px 3px 8px rgba(0, 0, 0, 0.4);
	}
</style>
