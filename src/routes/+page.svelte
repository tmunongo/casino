<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	let nickname = '';
	let mode: 'idle' | 'creating' | 'joining' | 'join-input' = 'idle';
	let joinId = '';
	let error = '';

	function generateId(): string {
		// nanoid-like 8-char alphanum ID
		const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
		return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
	}

	async function createGame() {
		if (!nickname.trim()) { error = 'Enter your name first'; return; }
		mode = 'creating';
		const id = generateId();
		if (browser) {
			localStorage.setItem(`game:${id}:role`, 'host');
			localStorage.setItem(`game:${id}:name`, nickname.trim());
		}
		await goto(`/game/${id}`);
	}

	async function joinGame() {
		if (!nickname.trim()) { error = 'Enter your name first'; return; }
		const id = joinId.trim().toLowerCase();
		if (!id) { error = 'Enter a game code'; return; }
		if (browser) {
			localStorage.setItem(`game:${id}:role`, 'joiner');
			localStorage.setItem(`game:${id}:name`, nickname.trim());
		}
		await goto(`/game/${id}`);
	}

	function clearError() { error = ''; }
</script>

<svelte:head>
	<title>Casino</title>
</svelte:head>

<main>
	<!-- Ambient background orbs -->
	<div class="orb orb-1" aria-hidden="true"></div>
	<div class="orb orb-2" aria-hidden="true"></div>
	<div class="orb orb-3" aria-hidden="true"></div>

	<div class="center">
		<!-- Title -->
		<header>
			<div class="suit-row" aria-hidden="true">♠ ♥ ♦ ♣</div>
			<h1>Casino</h1>
			<p class="tagline">A two-player card game. No server. Pure peer-to-peer.</p>
		</header>

		<!-- Card panel -->
		<div class="panel">
			{#if mode === 'creating'}
				<div class="spinner-wrap">
					<div class="spinner"></div>
					<p>Setting up your game…</p>
				</div>
			{:else}
				<!-- Name input -->
				<div class="field">
					<label for="nickname">Your name</label>
					<input
						id="nickname"
						type="text"
						placeholder="e.g. Alice"
						maxlength="20"
						bind:value={nickname}
						on:input={clearError}
						on:keydown={(e) => e.key === 'Enter' && createGame()}
					/>
				</div>

				{#if error}
					<p class="error">{error}</p>
				{/if}

				{#if mode === 'join-input'}
					<!-- Join flow -->
					<div class="field">
						<label for="joinId">Game code</label>
						<input
							id="joinId"
							type="text"
							placeholder="8-character code"
							maxlength="8"
							bind:value={joinId}
							on:keydown={(e) => e.key === 'Enter' && joinGame()}
						/>
					</div>
					<div class="btn-row">
						<button class="btn btn-secondary" on:click={() => { mode = 'idle'; joinId = ''; }}>
							← Back
						</button>
						<button class="btn btn-primary" on:click={joinGame}> Join Game </button>
					</div>
				{:else}
					<!-- Idle -->
					<div class="btn-row">
						<button class="btn btn-primary" on:click={createGame}> New Game </button>
						<button class="btn btn-secondary" on:click={() => mode = 'join-input'}>
							Join Game
						</button>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Instructions -->
		<details class="rules">
			<summary>How to play</summary>
			<div class="rules-body">
				<p>Match the <strong>suit</strong> or <strong>rank</strong> of the top discard card.</p>
				<p>
					<strong>Eights are wild</strong> — play one on anything, then choose the new suit.
				</p>
				<p>If you can't play, draw a card. Empty your hand first to win.</p>
			</div>
		</details>
	</div>
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		background: var(--bg-deep);
	}

	/* Ambient orbs */
	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.18;
		pointer-events: none;
	}
	.orb-1 {
		width: 500px;
		height: 500px;
		background: radial-gradient(circle, #c9a84c, transparent 70%);
		top: -100px;
		right: -80px;
	}
	.orb-2 {
		width: 400px;
		height: 400px;
		background: radial-gradient(circle, #2a6c3a, transparent 70%);
		bottom: -80px;
		left: -60px;
	}
	.orb-3 {
		width: 300px;
		height: 300px;
		background: radial-gradient(circle, #1a3a8c, transparent 70%);
		top: 40%;
		left: 40%;
	}

	.center {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 420px;
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}

	/* Header */
	header {
		text-align: center;
	}
	.suit-row {
		font-size: 1.4rem;
		color: var(--gold);
		letter-spacing: 0.5em;
		opacity: 0.7;
		margin-bottom: 0.5rem;
	}
	h1 {
		font-family: var(--font-display);
		font-size: clamp(2.4rem, 7vw, 3.2rem);
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 0.4rem;
		letter-spacing: 0.04em;
		line-height: 1;
	}
	.tagline {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0;
		font-style: italic;
	}

	/* Panel */
	.panel {
		width: 100%;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(201, 168, 76, 0.2);
		border-radius: 14px;
		padding: 2rem;
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 1.25rem;
	}
	label {
		font-family: var(--font-display);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold);
	}
	input {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(201, 168, 76, 0.3);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		color: var(--text-primary);
		font-family: var(--font-body);
		font-size: 1.05rem;
		outline: none;
		transition: border-color 0.15s;
	}
	input:focus {
		border-color: var(--gold);
		box-shadow: 0 0 0 2px var(--gold-glow);
	}
	input::placeholder {
		color: var(--text-muted);
	}

	.error {
		color: #e07060;
		font-size: 0.85rem;
		margin: -0.5rem 0 0.75rem;
	}

	.btn-row {
		display: flex;
		gap: 0.75rem;
	}
	.btn {
		flex: 1;
		padding: 0.85rem 1rem;
		border-radius: 8px;
		font-family: var(--font-display);
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border: none;
		transition: all 0.15s;
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
		border: 1px solid rgba(201, 168, 76, 0.25);
	}
	.btn-secondary:hover {
		border-color: var(--gold);
		color: var(--text-primary);
	}

	/* Loading */
	.spinner-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1rem 0;
		color: var(--text-secondary);
		font-style: italic;
	}
	.spinner {
		width: 32px;
		height: 32px;
		border: 2px solid rgba(201, 168, 76, 0.2);
		border-top-color: var(--gold);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Rules */
	.rules {
		width: 100%;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}
	.rules summary {
		font-family: var(--font-display);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--gold-dim);
		cursor: pointer;
		user-select: none;
		text-align: center;
	}
	.rules summary:hover {
		color: var(--gold);
	}
	.rules-body {
		margin-top: 0.75rem;
		padding: 1rem 1.25rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(201, 168, 76, 0.1);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.rules-body p {
		margin: 0;
	}
</style>
