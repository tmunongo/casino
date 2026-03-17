<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { myPlayerId, myName, destroySession } from '$lib/stores/game';

	const gameId = $page.params.id;

	interface PlayerResult {
		name: string;
		score: number;
	}

	interface GameResult {
		winner: string;
		winnerName: string;
		players: Record<string, PlayerResult>;
	}

	let result: GameResult | null = null;
	let myId = '';

	onMount(() => {
		if (!browser) return;
		myId = $myPlayerId || localStorage.getItem(`game:${gameId}:name`) || '';

		const raw = localStorage.getItem(`game:${gameId}:result`);
		if (raw) {
			try {
				result = JSON.parse(raw);
			} catch {
				result = null;
			}
		}
	});

	function playAgain() {
		destroySession();
		goto('/');
	}

	$: iWon = result?.winner === $myPlayerId;
	$: players = result ? Object.entries(result.players) : [];
</script>

<svelte:head>
	<title>Result · Crazy Eights</title>
</svelte:head>

<main>
	<div class="orb orb-1" aria-hidden="true"></div>
	<div class="orb orb-2" aria-hidden="true"></div>

	<div class="content">
		{#if result}
			<!-- Outcome badge -->
			<div class="outcome" class:win={iWon} class:loss={!iWon}>
				{#if iWon}
					<span class="outcome-icon">♛</span>
					<span class="outcome-text">Victory</span>
				{:else}
					<span class="outcome-icon">♟</span>
					<span class="outcome-text">Defeated</span>
				{/if}
			</div>

			<p class="winner-line">
				{result.winnerName} wins this hand
			</p>

			<!-- Scores -->
			<div class="scores">
				<h2 class="scores-title">Hand Scores</h2>
				<p class="scores-sub">(points remaining in hand — lower is better)</p>
				<div class="score-rows">
					{#each players as [pid, p]}
						<div class="score-row" class:is-winner={pid === result?.winner}>
							<span class="score-name">
								{p.name}
								{#if pid === result?.winner}<span class="winner-badge">winner</span>{/if}
							</span>
							<span class="score-val">{p.score} pts</span>
						</div>
					{/each}
				</div>
			</div>

		{:else}
			<div class="no-result">
				<p>No result data found.</p>
			</div>
		{/if}

		<div class="actions">
			<button class="btn btn-primary" on:click={playAgain}>Play Again</button>
			<button class="btn btn-secondary" on:click={() => { destroySession(); goto('/'); }}>
				Home
			</button>
		</div>

		<!-- Suit decoration -->
		<div class="suits-deco" aria-hidden="true">♠ ♥ ♦ ♣</div>
	</div>
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-deep);
		position: relative;
		overflow: hidden;
	}

	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.15;
		pointer-events: none;
	}
	.orb-1 {
		width: 500px; height: 500px;
		background: radial-gradient(circle, #c9a84c, transparent 70%);
		top: -120px; right: -60px;
	}
	.orb-2 {
		width: 400px; height: 400px;
		background: radial-gradient(circle, #1a6c3a, transparent 70%);
		bottom: -80px; left: -80px;
	}

	.content {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 400px;
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.75rem;
		text-align: center;
	}

	/* Outcome */
	.outcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.outcome-icon {
		font-size: 3rem;
		line-height: 1;
	}
	.outcome-text {
		font-family: var(--font-display);
		font-size: 1.8rem;
		letter-spacing: 0.08em;
		font-weight: 700;
	}
	.win .outcome-icon,
	.win .outcome-text { color: var(--gold); }
	.loss .outcome-icon,
	.loss .outcome-text { color: var(--text-secondary); }

	@keyframes pop-in {
		from { opacity: 0; transform: scale(0.7); }
		to { opacity: 1; transform: scale(1); }
	}

	.winner-line {
		font-size: 1rem;
		color: var(--text-secondary);
		margin: 0;
		font-style: italic;
	}

	/* Scores */
	.scores {
		width: 100%;
		background: rgba(255,255,255,0.03);
		border: 1px solid rgba(201, 168, 76, 0.2);
		border-radius: 12px;
		padding: 1.5rem;
	}
	.scores-title {
		font-family: var(--font-display);
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--gold);
		margin: 0 0 0.2rem;
	}
	.scores-sub {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0 0 1rem;
		font-style: italic;
	}
	.score-rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.score-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.8rem;
		border-radius: 7px;
		background: rgba(255,255,255,0.02);
		border: 1px solid transparent;
	}
	.score-row.is-winner {
		border-color: rgba(201, 168, 76, 0.3);
		background: rgba(201, 168, 76, 0.06);
	}
	.score-name {
		font-size: 1rem;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.winner-badge {
		font-family: var(--font-display);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		background: var(--gold);
		color: #0a1020;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
	}
	.score-val {
		font-family: var(--font-display);
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	/* Actions */
	.actions {
		display: flex;
		gap: 0.75rem;
		width: 100%;
	}
	.btn {
		flex: 1;
		padding: 0.85rem 1rem;
		border-radius: 8px;
		font-family: var(--font-display);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border: none;
		transition: all 0.15s;
		cursor: pointer;
	}
	.btn-primary {
		background: var(--gold);
		color: #0a1020;
		font-weight: 700;
	}
	.btn-primary:hover {
		background: var(--gold-light);
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(201, 168, 76, 0.4);
	}
	.btn-secondary {
		background: transparent;
		color: var(--text-secondary);
		border: 1px solid rgba(201, 168, 76, 0.2);
	}
	.btn-secondary:hover {
		border-color: var(--gold);
		color: var(--text-primary);
	}

	.no-result { color: var(--text-muted); font-style: italic; }

	.suits-deco {
		font-size: 1.1rem;
		letter-spacing: 0.5em;
		color: var(--gold-dim);
		opacity: 0.6;
	}
</style>
