<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import {
		gofishState,
		myGofishPlayerId,
		myGofishName,
		gofishOpponentName,
		gofishConnectionStatus,
		isMyGofishTurn,
		myGofishHand,
		myGofishBooks,
		setupGofishHost,
		setupGofishJoiner,
		makeGofishMove,
		gofishErrorMessage
	} from '$lib/stores/gofish';
	import PlayingCard from '$lib/components/PlayingCard.svelte';
	import { ranksInHand, type GofishState } from '$lib/game/gofish';
	import { RANKS, type Rank } from '$lib/game/cards';

	const gameId = $page.params.id as string;

	let shareUrl = '';
	let copied = false;
	let playerName = '';
	let showNamePrompt = false;
	let nameInput = '';
	let amHost = false;
	let selectedRank: Rank | null = null;

	// ── Lifecycle ──────────────────────────────────────────────────────────────

	onMount(async () => {
		if (!browser) return;
		shareUrl = `${window.location.origin}/gofish/${gameId}`;

		const storedName = localStorage.getItem(`game:${gameId}:name`);
		const storedRole = localStorage.getItem(`game:${gameId}:role`);

		if (!storedName) {
			showNamePrompt = true;
			return;
		}

		playerName = storedName;
		amHost = storedRole === 'host';

		if (amHost) {
			setupGofishHost(gameId, playerName);
		} else {
			setupGofishJoiner(gameId, playerName);
		}
	});

	// ── Watch for game over ────────────────────────────────────────────────────

	let redirected = false;
	$: if ($gofishState?.phase === 'over' && !redirected) {
		redirected = true;
		if (browser && $gofishState.winner) {
			const summary = {
				winner: $gofishState.winner,
				winnerName: $gofishState.players[$gofishState.winner]?.name ?? '?',
				players: Object.fromEntries(
					Object.entries($gofishState.players).map(([id, p]) => [
						id,
						{ name: p.name, books: p.books.length }
					])
				)
			};
			localStorage.setItem(`game:${gameId}:gofish-result`, JSON.stringify(summary));
		}
		setTimeout(() => goto(`/postgame/gofish/${gameId}`), 2000);
	}

	// ── Derived ────────────────────────────────────────────────────────────────

	$: opponentPlayerId = $gofishState
		? $gofishState.playerOrder.find((id) => id !== $myGofishPlayerId) ?? null
		: null;

	$: opponentPlayer = opponentPlayerId ? $gofishState?.players[opponentPlayerId] : null;
	$: myRanks = ranksInHand($myGofishHand);
	$: deckCount = $gofishState?.deck.length ?? 0;
	$: mustDraw = $gofishState?.mustDrawFromPond ?? false;
	$: pondMessage = $gofishState?.pondMessage ?? null;

	// ── Actions ────────────────────────────────────────────────────────────────

	function askForRank() {
		if (!$isMyGofishTurn || !selectedRank || !opponentPlayerId || mustDraw) return;
		makeGofishMove({ type: 'ask', targetId: opponentPlayerId, rank: selectedRank });
		selectedRank = null;
	}

	function drawFromPond() {
		if (!$isMyGofishTurn || !mustDraw) return;
		makeGofishMove({ type: 'drawFromPond' });
	}

	async function copyLink() {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function confirmName() {
		if (!nameInput.trim()) return;
		playerName = nameInput.trim();
		amHost = false;
		localStorage.setItem(`game:${gameId}:name`, playerName);
		localStorage.setItem(`game:${gameId}:role`, 'joiner');
		showNamePrompt = false;
		setupGofishJoiner(gameId, playerName);
	}
</script>

<svelte:head>
	<title>Go Fish · Casino</title>
</svelte:head>

<!-- Name prompt -->
{#if showNamePrompt}
	<div class="prompt-overlay">
		<div class="prompt-panel">
			<h2>Join the game</h2>
			<div class="field">
				<label for="pname">Your name</label>
				<input
					id="pname"
					type="text"
					placeholder="Enter your name"
					maxlength="20"
					bind:value={nameInput}
					on:keydown={(e) => e.key === 'Enter' && confirmName()}
					autofocus
				/>
			</div>
			<button class="action-btn gold" on:click={confirmName}>Join</button>
		</div>
	</div>
{/if}

<div class="table">
	<!-- HUD -->
	<header class="hud">
		<div class="hud-left">
			<span class="logo">Go Fish</span>
		</div>
		<div class="hud-center">
			{#if $gofishConnectionStatus === 'waiting'}
				<span class="status waiting">Waiting for opponent…</span>
			{:else if $gofishConnectionStatus === 'connected' && $gofishState}
				{#if $isMyGofishTurn}
					<span class="status your-turn">Your turn</span>
				{:else}
					<span class="status waiting">{$gofishOpponentName ?? 'Opponent'}'s turn…</span>
				{/if}
			{:else if $gofishConnectionStatus === 'disconnected'}
				<span class="status error">Opponent disconnected</span>
			{:else if $gofishConnectionStatus === 'error'}
				<span class="status error">{$gofishErrorMessage}</span>
			{/if}
		</div>
		<div class="hud-right">
			{#if $gofishState}
				<span class="hud-info">Pond: {deckCount}</span>
			{/if}
		</div>
	</header>

	<!-- Lobby -->
	{#if $gofishConnectionStatus === 'waiting' && !$gofishState}
		<div class="lobby">
			{#if amHost}
				<div class="lobby-panel">
					<p class="lobby-title">Share this link to invite your opponent</p>
					<div class="share-row">
						<code class="share-code">{shareUrl}</code>
						<button class="copy-btn" on:click={copyLink}>
							{copied ? '✓ Copied' : 'Copy'}
						</button>
					</div>
					<div class="waiting-indicator">
						<div class="dot-row">
							<span class="dot"></span><span class="dot"></span><span class="dot"></span>
						</div>
						<p>Waiting for player to join…</p>
					</div>
				</div>
			{:else}
				<div class="lobby-panel">
					<div class="waiting-indicator">
						<div class="dot-row">
							<span class="dot"></span><span class="dot"></span><span class="dot"></span>
						</div>
						<p>Connecting to game…</p>
					</div>
				</div>
			{/if}
		</div>

	<!-- Active game -->
	{:else if $gofishState}
		<!-- Opponent area -->
		<section class="player-zone opponent-zone" class:active={!$isMyGofishTurn && $gofishState.phase === 'playing'}>
			<div class="player-label">
				<span class="player-name">{$gofishOpponentName ?? 'Opponent'}</span>
				<span class="card-count">{opponentPlayer?.hand.length ?? 0} cards</span>
				<span class="books-badge">📚 {opponentPlayer?.books.length ?? 0}</span>
				{#if !$isMyGofishTurn && $gofishState.phase === 'playing'}
					<span class="turn-gem"></span>
				{/if}
			</div>
			<div class="hand opponent-hand">
				{#each (opponentPlayer?.hand ?? []) as card, i}
					<div
						class="card-wrap"
						style="
							--rotate: {(i - ((opponentPlayer?.hand.length ?? 1) - 1) / 2) * 2.5}deg;
							--lift: {Math.abs(i - ((opponentPlayer?.hand.length ?? 1) - 1) / 2) * 1.5}px;
							z-index: {i}
						"
					>
						<PlayingCard {card} faceUp={false} size="sm" />
					</div>
				{/each}
			</div>
		</section>

		<!-- Pond -->
		<div class="pond-row">
			{#if pondMessage}
				<div class="pond-msg" class:gofish={pondMessage === 'Go Fish!'}>
					{pondMessage}
				</div>
			{/if}
			<div class="pond-pile">
				{#each Array(Math.min(deckCount, 5)) as _, i}
					<div class="deck-ghost" style="--depth: {i}"></div>
				{/each}
				<span class="deck-label">{deckCount > 0 ? deckCount : '—'}</span>
			</div>
			<span class="pile-label">Pond</span>
		</div>

		<!-- My area -->
		<section class="player-zone my-zone" class:active={$isMyGofishTurn}>
			<div class="hand my-hand">
				{#each $myGofishHand as card, i}
					<div
						class="card-wrap"
						style="
							--rotate: {(i - ($myGofishHand.length - 1) / 2) * 2.5}deg;
							--lift: {Math.abs(i - ($myGofishHand.length - 1) / 2) * 1.5}px;
							z-index: {i}
						"
					>
						<PlayingCard
							{card}
							faceUp={true}
							playable={$isMyGofishTurn && !mustDraw && myRanks.includes(card.rank)}
							highlighted={selectedRank === card.rank}
							size="md"
							on:click={() => {
								if ($isMyGofishTurn && !mustDraw) selectedRank = card.rank;
							}}
						/>
					</div>
				{/each}
			</div>

			<div class="player-actions">
				<div class="player-label">
					<span class="player-name">{$myGofishName}</span>
					<span class="card-count">{$myGofishHand.length} cards</span>
					<span class="books-badge">📚 {$myGofishBooks.length}</span>
					{#if $isMyGofishTurn}
						<span class="turn-gem"></span>
					{/if}
				</div>

				<div class="action-area">
					{#if mustDraw}
						<button
							class="action-btn"
							class:active={$isMyGofishTurn}
							disabled={!$isMyGofishTurn}
							on:click={drawFromPond}
						>
							🎣 Go Fish! (Draw)
						</button>
					{:else}
						<div class="rank-picker">
							<span class="picker-label">Ask for:</span>
							<div class="rank-buttons">
								{#each RANKS as rank}
									<button
										class="rank-btn"
										class:selected={selectedRank === rank}
										class:available={myRanks.includes(rank)}
										disabled={!$isMyGofishTurn || !myRanks.includes(rank)}
										on:click={() => (selectedRank = rank)}
									>
										{rank}
									</button>
								{/each}
							</div>
						</div>
						<button
							class="action-btn gold"
							disabled={!$isMyGofishTurn || !selectedRank}
							on:click={askForRank}
						>
							Ask!
						</button>
					{/if}
				</div>

				<!-- Books display -->
				{#if $myGofishBooks.length > 0}
					<div class="books-row">
						{#each $myGofishBooks as rank}
							<div class="book-chip">{rank}</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<!-- Game over -->
		{#if $gofishState.phase === 'over'}
			<div class="game-over-banner">
				{#if $gofishState.winner === $myGofishPlayerId}
					<span>🏆 You win!</span>
				{:else}
					<span>{$gofishState.players[$gofishState.winner ?? '']?.name ?? 'Opponent'} wins!</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.table {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-felt);
		background-image:
			radial-gradient(circle at 30% 40%, rgba(10, 60, 100, 0.3) 0%, transparent 60%),
			radial-gradient(circle at 70% 60%, rgba(5, 40, 80, 0.3) 0%, transparent 60%),
			repeating-linear-gradient(
				0deg, transparent, transparent 30px,
				rgba(255,255,255,0.012) 30px, rgba(255,255,255,0.012) 31px
			),
			repeating-linear-gradient(
				90deg, transparent, transparent 30px,
				rgba(255,255,255,0.012) 30px, rgba(255,255,255,0.012) 31px
			);
		overflow: hidden;
		position: relative;
	}

	/* HUD */
	.hud {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1.5rem;
		background: rgba(5, 10, 20, 0.6);
		border-bottom: 1px solid rgba(201, 168, 76, 0.15);
		backdrop-filter: blur(4px);
		flex-shrink: 0;
		z-index: 10;
	}
	.logo {
		font-family: var(--font-display);
		font-size: 0.85rem;
		letter-spacing: 0.12em;
		color: var(--gold);
		text-transform: uppercase;
	}
	.hud-info {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-family: var(--font-display);
		letter-spacing: 0.06em;
	}
	.status {
		font-family: var(--font-display);
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 0.3rem 0.8rem;
		border-radius: 20px;
	}
	.status.waiting { color: var(--text-secondary); background: rgba(255,255,255,0.04); }
	.status.your-turn {
		color: #0a1020;
		background: var(--gold);
		font-weight: 700;
		animation: pulse-gold 1.5s ease infinite;
	}
	.status.error { color: #e07060; }
	@keyframes pulse-gold {
		0%, 100% { box-shadow: 0 0 0 0 rgba(201, 168, 76, 0.5); }
		50% { box-shadow: 0 0 0 6px rgba(201, 168, 76, 0); }
	}

	/* Lobby */
	.lobby {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}
	.lobby-panel {
		background: rgba(5, 15, 25, 0.7);
		border: 1px solid rgba(201, 168, 76, 0.25);
		border-radius: 14px;
		padding: 2.5rem;
		max-width: 480px;
		width: 100%;
		text-align: center;
		box-shadow: 0 8px 40px rgba(0,0,0,0.5);
	}
	.lobby-title {
		font-family: var(--font-display);
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold);
		margin: 0 0 1.25rem;
	}
	.share-row { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
	.share-code {
		flex: 1;
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(201, 168, 76, 0.2);
		border-radius: 7px;
		padding: 0.6rem 0.8rem;
		font-family: 'Courier New', monospace;
		font-size: 0.75rem;
		color: var(--text-secondary);
		word-break: break-all;
		text-align: left;
	}
	.copy-btn {
		background: var(--gold);
		color: #0a1020;
		border: none;
		border-radius: 7px;
		padding: 0 1rem;
		font-family: var(--font-display);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		white-space: nowrap;
		transition: background 0.12s;
	}
	.copy-btn:hover { background: var(--gold-light); }
	.waiting-indicator { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; color: var(--text-muted); font-style: italic; }
	.dot-row { display: flex; gap: 0.4rem; }
	.dot { width: 8px; height: 8px; background: var(--gold-dim); border-radius: 50%; animation: blink 1.4s ease infinite; }
	.dot:nth-child(2) { animation-delay: 0.2s; }
	.dot:nth-child(3) { animation-delay: 0.4s; }
	@keyframes blink {
		0%, 80%, 100% { opacity: 0.3; transform: scale(1); }
		40% { opacity: 1; transform: scale(1.2); }
	}

	/* Player zones */
	.player-zone {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		transition: background 0.3s;
	}
	.player-zone.active { background: rgba(201, 168, 76, 0.04); }
	.opponent-zone { flex-shrink: 0; }
	.my-zone { flex-shrink: 0; flex-direction: column-reverse; }

	.player-label { display: flex; align-items: center; gap: 0.5rem; }
	.player-name { font-family: var(--font-display); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-secondary); }
	.card-count { font-size: 0.72rem; color: var(--text-muted); }
	.books-badge { font-size: 0.72rem; color: var(--gold-dim); }
	.turn-gem { width: 8px; height: 8px; background: var(--gold); border-radius: 50%; animation: pulse-gold 1.5s ease infinite; }

	/* Hands */
	.hand { display: flex; align-items: flex-end; justify-content: center; }
	.card-wrap { transform: rotate(var(--rotate)) translateY(var(--lift)); transition: transform 0.15s ease; margin: 0 -8px; }
	.card-wrap:first-child { margin-left: 0; }
	.card-wrap:last-child { margin-right: 0; }
	.opponent-hand { transform: rotate(180deg); }

	/* Pond */
	.pond-row {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}
	.pond-pile {
		position: relative;
		width: 68px;
		height: 98px;
	}
	.deck-ghost {
		position: absolute;
		width: 68px;
		height: 98px;
		border-radius: var(--radius-card);
		background: linear-gradient(145deg, #0a2a4a, #1a3a6c);
		border: 1px solid rgba(201, 168, 76, 0.3);
		bottom: calc(var(--depth) * 2px);
		left: calc(var(--depth) * -1px);
		box-shadow: 1px 1px 4px rgba(0,0,0,0.4);
	}
	.deck-label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-size: 1rem;
		color: rgba(201, 168, 76, 0.7);
		z-index: 10;
	}
	.pile-label {
		font-family: var(--font-display);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin: 0;
	}
	.pond-msg {
		font-family: var(--font-display);
		font-size: 0.85rem;
		letter-spacing: 0.06em;
		color: var(--text-secondary);
		background: rgba(5,15,25,0.7);
		border: 1px solid rgba(201,168,76,0.2);
		border-radius: 20px;
		padding: 0.3rem 1rem;
		animation: pop-in 0.2s ease;
	}
	.pond-msg.gofish {
		color: var(--gold);
		border-color: var(--gold);
	}

	/* Action area */
	.player-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: center; }
	.action-area { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; justify-content: center; }
	.action-btn {
		padding: 0.5rem 1.2rem;
		border-radius: 7px;
		font-family: var(--font-display);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(201, 168, 76, 0.2);
		color: var(--text-muted);
		transition: all 0.12s;
		cursor: not-allowed;
	}
	.action-btn.active,
	.action-btn:not(:disabled) {
		border-color: var(--gold);
		color: var(--gold);
		cursor: pointer;
	}
	.action-btn.gold:not(:disabled) {
		background: var(--gold);
		color: #0a1020;
		font-weight: 700;
	}
	.action-btn:not(:disabled):hover { background: rgba(201, 168, 76, 0.12); transform: translateY(-1px); }
	.action-btn.gold:not(:disabled):hover { background: var(--gold-light); }

	/* Rank picker */
	.rank-picker { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; }
	.picker-label { font-family: var(--font-display); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold-dim); }
	.rank-buttons { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
	.rank-btn {
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: 1px solid rgba(201,168,76,0.15);
		background: rgba(255,255,255,0.03);
		color: var(--text-muted);
		font-family: var(--font-display);
		font-size: 0.65rem;
		font-weight: 700;
		cursor: not-allowed;
		transition: all 0.12s;
	}
	.rank-btn.available {
		border-color: rgba(201,168,76,0.4);
		color: var(--text-secondary);
		cursor: pointer;
	}
	.rank-btn.available:hover {
		border-color: var(--gold);
		color: var(--gold);
		background: rgba(201,168,76,0.08);
	}
	.rank-btn.selected {
		background: var(--gold);
		color: #0a1020;
		border-color: var(--gold);
	}

	/* Books */
	.books-row { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; margin-top: 0.25rem; }
	.book-chip {
		background: rgba(201,168,76,0.15);
		border: 1px solid rgba(201,168,76,0.35);
		border-radius: 5px;
		padding: 2px 7px;
		font-family: var(--font-display);
		font-size: 0.65rem;
		color: var(--gold);
		font-weight: 700;
	}

	/* Game over */
	.game-over-banner {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: rgba(5, 10, 20, 0.92);
		border: 1px solid var(--gold);
		border-radius: 14px;
		padding: 1.5rem 3rem;
		font-family: var(--font-display);
		font-size: 1.4rem;
		letter-spacing: 0.06em;
		color: var(--gold);
		text-align: center;
		box-shadow: 0 0 60px rgba(201, 168, 76, 0.3), 0 20px 60px rgba(0,0,0,0.6);
		animation: pop-in 0.25s ease;
		z-index: 50;
	}
	@keyframes pop-in {
		from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
		to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	}

	/* Name prompt */
	.prompt-overlay {
		position: fixed;
		inset: 0;
		background: rgba(4, 8, 18, 0.85);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 300;
	}
	.prompt-panel {
		background: #101c2c;
		border: 1px solid var(--gold);
		border-radius: 14px;
		padding: 2.5rem;
		width: 320px;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		box-shadow: 0 0 60px rgba(201, 168, 76, 0.2), 0 20px 60px rgba(0,0,0,0.6);
	}
	.prompt-panel h2 { font-family: var(--font-display); color: var(--gold); font-size: 1rem; margin: 0; letter-spacing: 0.06em; }
	.field { display: flex; flex-direction: column; gap: 0.4rem; }
	label { font-family: var(--font-display); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold); }
	input {
		background: rgba(255,255,255,0.05);
		border: 1px solid rgba(201,168,76,0.3);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		color: var(--text-primary);
		font-family: var(--font-body);
		font-size: 1.05rem;
		outline: none;
		transition: border-color 0.15s;
	}
	input:focus { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold-glow); }
</style>
