<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import {
		gameState,
		myPlayerId,
		myName,
		opponentName,
		connectionStatus,
		isMyTurn,
		myHand,
		setupHost,
		setupJoiner,
		makeMove,
		errorMessage
	} from '$lib/stores/game';
	import PlayingCard from '$lib/components/PlayingCard.svelte';
	import SuitPicker from '$lib/components/SuitPicker.svelte';
	import { getLegalPlays, canPlay, scoreHand, type GameState } from '$lib/game/rules';
	import { SUIT_SYMBOLS, SUIT_NAMES, type Suit } from '$lib/game/cards';

	const gameId = $page.params.id as string;

	let showSuitPicker = false;
	let pendingCardId: string | null = null;
	let shareUrl = '';
	let copied = false;
	let playerName = '';
	let showNamePrompt = false;
	let nameInput = '';
	let amHost = false;

	// ── Lifecycle ──────────────────────────────────────────────────────────────

	onMount(async () => {
		if (!browser) return;

		shareUrl = `${window.location.origin}/game/${gameId}`;

		let storedName = localStorage.getItem(`game:${gameId}:name`);
		let storedRole = localStorage.getItem(`game:${gameId}:role`);

		// If opening a shared link with no stored data → ask for name first
		if (!storedName) {
			showNamePrompt = true;
			storedRole = 'joiner';
			return;
		}

		playerName = storedName;
		const hosting = storedRole === 'host';
		amHost = hosting;

		if (hosting) {
			setupHost(gameId, playerName);
		} else {
			setupJoiner(gameId, playerName);
		}
	});

	onDestroy(() => {
		// peer cleanup handled by navigation away from game
	});

	// ── Watch for game over ────────────────────────────────────────────────────

	let redirected = false;
	$: if ($gameState?.phase === 'over' && !redirected) {
		redirected = true;
		// Store summary for postgame page
		if (browser && $gameState.winner) {
			const summary = {
				winner: $gameState.winner,
				winnerName: $gameState.players[$gameState.winner]?.name ?? '?',
				players: Object.fromEntries(
					Object.entries($gameState.players).map(([id, p]) => [
						id,
						{ name: p.name, score: scoreHand(p.hand) }
					])
				)
			};
			localStorage.setItem(`game:${gameId}:result`, JSON.stringify(summary));
		}
		setTimeout(() => goto(`/postgame/${gameId}`), 1800);
	}

	// ── Derived game state ─────────────────────────────────────────────────────

	$: legalIds = $gameState && $myPlayerId && $isMyTurn
		? getLegalPlays($gameState, $myPlayerId).map((c) => c.id)
		: [];

	$: opponentPlayerId = $gameState
		? $gameState.playerOrder.find((id) => id !== $myPlayerId) ?? null
		: null;

	$: opponentHand = $gameState && opponentPlayerId
		? $gameState.players[opponentPlayerId]?.hand ?? []
		: [];

	$: topCard = $gameState?.discardPile[$gameState.discardPile.length - 1] ?? null;
	$: deckCount = $gameState?.deck.length ?? 0;
	$: declaredSuit = $gameState?.declaredSuit ?? null;
	$: lastDrawnId = $gameState?.lastDrawnCardId ?? null;

	$: canDraw = $isMyTurn && deckCount > 0;
	$: canPassNow =
		$isMyTurn &&
		$gameState &&
		deckCount === 0 &&
		!canPlay($gameState, $myPlayerId);

	// ── Actions ────────────────────────────────────────────────────────────────

	function handleCardClick(card: CustomEvent<import('$lib/game/cards').Card>) {
		const c = card.detail;
		if (!$isMyTurn || !legalIds.includes(c.id)) return;

		if (c.rank === '8') {
			pendingCardId = c.id;
			showSuitPicker = true;
		} else {
			makeMove({ type: 'playCard', cardId: c.id });
		}
	}

	function handleSuitPick(e: CustomEvent<Suit>) {
		if (!pendingCardId) return;
		makeMove({ type: 'playCard', cardId: pendingCardId, declaredSuit: e.detail });
		showSuitPicker = false;
		pendingCardId = null;
	}

	function handleDraw() {
		if (!canDraw) return;
		makeMove({ type: 'drawCard' });
	}

	function handlePass() {
		if (!canPassNow) return;
		makeMove({ type: 'pass' });
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
		setupJoiner(gameId, playerName);
	}
</script>

<svelte:head>
	<title>Game · Casino</title>
</svelte:head>

<!-- ── Name prompt (for direct link openers) ──────────────────────────────── -->
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

<!-- ── Suit picker overlay ─────────────────────────────────────────────────── -->
{#if showSuitPicker}
	<SuitPicker on:pick={handleSuitPick} />
{/if}

<!-- ── Main game layout ───────────────────────────────────────────────────── -->
<div class="table">
	<!-- Top HUD -->
	<header class="hud">
		<div class="hud-left">
			<span class="logo">Casino</span>
		</div>
		<div class="hud-center">
			{#if $connectionStatus === 'waiting'}
				<span class="status waiting">Waiting for opponent…</span>
			{:else if $connectionStatus === 'connected' && $gameState}
				{#if $isMyTurn}
					<span class="status your-turn">Your turn</span>
				{:else}
					<span class="status waiting">{$opponentName ?? 'Opponent'}'s turn…</span>
				{/if}
			{:else if $connectionStatus === 'disconnected'}
				<span class="status error">Opponent disconnected</span>
			{:else if $connectionStatus === 'error'}
				<span class="status error">{$errorMessage}</span>
			{/if}
		</div>
		<div class="hud-right">
			{#if $gameState}
				<span class="hud-info">Deck: {deckCount}</span>
			{/if}
		</div>
	</header>

	<!-- ── Waiting lobby ──────────────────────────────────────────────────── -->
	{#if $connectionStatus === 'waiting' && !$gameState}
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

	<!-- ── Active game ────────────────────────────────────────────────────── -->
	{:else if $gameState}

		<!-- Opponent area (top) -->
		<section class="player-zone opponent-zone" class:active={!$isMyTurn && $gameState.phase === 'playing'}>
			<div class="player-label">
				<span class="player-name">{$opponentName ?? 'Opponent'}</span>
				<span class="card-count">{opponentHand.length} card{opponentHand.length !== 1 ? 's' : ''}</span>
				{#if !$isMyTurn && $gameState.phase === 'playing'}
					<span class="turn-gem"></span>
				{/if}
			</div>
			<div class="hand opponent-hand">
				{#each opponentHand as card, i}
					<div
						class="card-wrap"
						style="
							--rotate: {(i - (opponentHand.length - 1) / 2) * 2.5}deg;
							--lift: {Math.abs(i - (opponentHand.length - 1) / 2) * 1.5}px;
							z-index: {i}
						"
					>
						<PlayingCard {card} faceUp={false} size="sm" />
					</div>
				{/each}
			</div>
		</section>

		<!-- Table center -->
		<section class="table-center">
			<!-- Deck pile -->
			<div class="pile-group">
				<button
					class="deck-pile"
					class:drawable={canDraw}
					on:click={handleDraw}
					disabled={!canDraw}
					aria-label="Draw a card"
				>
					{#each Array(Math.min(deckCount, 5)) as _, i}
						<div class="deck-ghost" style="--depth: {i}"></div>
					{/each}
					<span class="deck-label">{deckCount > 0 ? deckCount : '—'}</span>
				</button>
				<p class="pile-label">Stock</p>
			</div>

			<!-- Center info -->
			<div class="center-info">
				{#if declaredSuit}
					<div class="declared-suit" title="Declared suit: {SUIT_NAMES[declaredSuit]}">
						<span class="declared-sym" class:suit-red={declaredSuit === 'hearts' || declaredSuit === 'diamonds'}>
							{SUIT_SYMBOLS[declaredSuit]}
						</span>
						<span class="declared-lbl">declared</span>
					</div>
				{/if}
			</div>

			<!-- Discard pile -->
			<div class="pile-group">
				{#if topCard}
					<div class="discard-pile">
						<PlayingCard card={topCard} faceUp={true} size="lg" />
					</div>
				{/if}
				<p class="pile-label">Discard</p>
			</div>
		</section>

		<!-- My area (bottom) -->
		<section class="player-zone my-zone" class:active={$isMyTurn}>
			<div class="hand my-hand">
				{#each $myHand as card, i}
					<div
						class="card-wrap"
						style="
							--rotate: {(i - ($myHand.length - 1) / 2) * 2.5}deg;
							--lift: {Math.abs(i - ($myHand.length - 1) / 2) * 1.5}px;
							z-index: {i}
						"
					>
						<PlayingCard
							{card}
							faceUp={true}
							playable={legalIds.includes(card.id)}
							highlighted={card.id === lastDrawnId}
							size="md"
							on:click={handleCardClick}
						/>
					</div>
				{/each}
			</div>

			<div class="player-actions">
				<div class="player-label">
					<span class="player-name">{$myName}</span>
					<span class="card-count">{$myHand.length} card{$myHand.length !== 1 ? 's' : ''}</span>
					{#if $isMyTurn}
						<span class="turn-gem"></span>
					{/if}
				</div>

				<div class="action-btns">
					<button
						class="action-btn"
						class:active={canDraw}
						disabled={!canDraw}
						on:click={handleDraw}
					>
						Draw
					</button>
					<button
						class="action-btn"
						class:active={canPassNow}
						disabled={!canPassNow}
						on:click={handlePass}
					>
						Pass
					</button>
				</div>
			</div>
		</section>

		<!-- Game over flash -->
		{#if $gameState.phase === 'over'}
			<div class="game-over-banner">
				{#if $gameState.winner === $myPlayerId}
					<span>🏆 You win!</span>
				{:else}
					<span>{$gameState.players[$gameState.winner ?? '']?.name ?? 'Opponent'} wins!</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	/* ── Table ────────────────────────────────────────────────────────────── */
	.table {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-felt);
		background-image:
			radial-gradient(circle at 30% 40%, rgba(40, 80, 50, 0.3) 0%, transparent 60%),
			radial-gradient(circle at 70% 60%, rgba(20, 60, 35, 0.3) 0%, transparent 60%),
			repeating-linear-gradient(
				0deg,
				transparent,
				transparent 30px,
				rgba(255,255,255,0.012) 30px,
				rgba(255,255,255,0.012) 31px
			),
			repeating-linear-gradient(
				90deg,
				transparent,
				transparent 30px,
				rgba(255,255,255,0.012) 30px,
				rgba(255,255,255,0.012) 31px
			);
		overflow: hidden;
		position: relative;
	}

	/* ── HUD ──────────────────────────────────────────────────────────────── */
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
	.status.waiting {
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.04);
	}
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

	/* ── Lobby ────────────────────────────────────────────────────────────── */
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
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
	}
	.lobby-title {
		font-family: var(--font-display);
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gold);
		margin: 0 0 1.25rem;
	}
	.share-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}
	.share-code {
		flex: 1;
		background: rgba(255, 255, 255, 0.04);
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

	.waiting-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-muted);
		font-style: italic;
	}
	.dot-row {
		display: flex;
		gap: 0.4rem;
	}
	.dot {
		width: 8px;
		height: 8px;
		background: var(--gold-dim);
		border-radius: 50%;
		animation: blink 1.4s ease infinite;
	}
	.dot:nth-child(2) { animation-delay: 0.2s; }
	.dot:nth-child(3) { animation-delay: 0.4s; }
	@keyframes blink {
		0%, 80%, 100% { opacity: 0.3; transform: scale(1); }
		40% { opacity: 1; transform: scale(1.2); }
	}

	/* ── Player zones ─────────────────────────────────────────────────────── */
	.player-zone {
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		transition: background 0.3s;
	}
	.player-zone.active {
		background: rgba(201, 168, 76, 0.04);
	}
	.opponent-zone { flex-shrink: 0; }
	.my-zone {
		flex-shrink: 0;
		flex-direction: column-reverse;
	}

	.player-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.player-name {
		font-family: var(--font-display);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-secondary);
	}
	.card-count {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.turn-gem {
		width: 8px;
		height: 8px;
		background: var(--gold);
		border-radius: 50%;
		animation: pulse-gold 1.5s ease infinite;
	}

	/* ── Hands ────────────────────────────────────────────────────────────── */
	.hand {
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.card-wrap {
		transform: rotate(var(--rotate)) translateY(var(--lift));
		transition: transform 0.15s ease;
		margin: 0 -8px;
	}
	.card-wrap:first-child { margin-left: 0; }
	.card-wrap:last-child { margin-right: 0; }

	.opponent-hand { transform: rotate(180deg); }

	/* ── Table center ─────────────────────────────────────────────────────── */
	.table-center {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2.5rem;
		padding: 0.5rem 2rem;
	}

	.pile-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	.pile-label {
		font-family: var(--font-display);
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin: 0;
	}

	/* Deck pile (stacked cards effect) */
	.deck-pile {
		position: relative;
		width: 68px;
		height: 98px;
		cursor: default;
		background: none;
		border: none;
		padding: 0;
	}
	.deck-pile.drawable { cursor: pointer; }
	.deck-ghost {
		position: absolute;
		width: 68px;
		height: 98px;
		border-radius: var(--radius-card);
		background: linear-gradient(145deg, #1a2a6c, #2c1a5e);
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
	.deck-pile.drawable:hover .deck-ghost:last-of-type {
		transform: translateY(-4px);
		box-shadow: 0 6px 16px rgba(201, 168, 76, 0.3);
		border-color: var(--gold);
	}
	.deck-pile:disabled { opacity: 0.4; cursor: not-allowed; }

	.discard-pile {
		filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.5));
	}

	/* Declared suit indicator */
	.center-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 60px;
	}
	.declared-suit {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		background: rgba(5, 15, 25, 0.6);
		border: 1px solid rgba(201, 168, 76, 0.3);
		border-radius: 8px;
		padding: 0.5rem 0.8rem;
	}
	.declared-sym {
		font-size: 1.8rem;
		line-height: 1;
		color: #1a1a2e;
	}
	.declared-sym.suit-red { color: var(--card-red); }
	.declared-lbl {
		font-family: var(--font-display);
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--gold-dim);
	}

	/* ── Action buttons ───────────────────────────────────────────────────── */
	.player-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.action-btns {
		display: flex;
		gap: 0.5rem;
	}
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
	.action-btn:not(:disabled):hover {
		background: rgba(201, 168, 76, 0.12);
		transform: translateY(-1px);
	}

	/* ── Game over banner ─────────────────────────────────────────────────── */
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
		to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	}

	/* ── Name prompt overlay ──────────────────────────────────────────────── */
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
	.prompt-panel h2 {
		font-family: var(--font-display);
		color: var(--gold);
		font-size: 1rem;
		margin: 0;
		letter-spacing: 0.06em;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.field label {
		font-family: var(--font-display);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold);
	}
	.field input {
		background: rgba(255,255,255,0.05);
		border: 1px solid rgba(201,168,76,0.3);
		border-radius: 7px;
		padding: 0.7rem 0.9rem;
		color: var(--text-primary);
		font-family: var(--font-body);
		font-size: 1rem;
		outline: none;
	}
	.field input:focus { border-color: var(--gold); }
	.action-btn.gold {
		background: var(--gold);
		color: #0a1020;
		font-weight: 700;
		cursor: pointer;
		padding: 0.7rem 1rem;
		border-color: var(--gold);
	}
	.action-btn.gold:hover { background: var(--gold-light); }
</style>
