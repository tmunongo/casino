import type { GameState, Move } from '$lib/game/rules';
import type { GofishState, GofishMove } from '$lib/game/gofish';

// ─── Message types ────────────────────────────────────────────────────────────

export type NetworkMessage =
	| { type: 'PLAYER_JOIN'; name: string; playerId: string }
	// Crazy Eights
	| { type: 'GAME_START'; state: GameState }
	| { type: 'MOVE'; move: Move; playerId: string }
	| { type: 'STATE_UPDATE'; state: GameState }
	// Go Fish
	| { type: 'GF_GAME_START'; state: GofishState }
	| { type: 'GF_MOVE'; move: GofishMove; playerId: string }
	| { type: 'GF_STATE_UPDATE'; state: GofishState };

export interface PeerCallbacks {
	onPeerOpen?: (peerId: string) => void;
	onConnect?: (remotePeerId: string) => void;
	onMessage?: (msg: NetworkMessage, fromId: string) => void;
	onDisconnect?: () => void;
	onError?: (err: Error) => void;
}

// ─── GamePeer class ───────────────────────────────────────────────────────────

export class GamePeer {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private peer: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private conn: any = null;
	private callbacks: PeerCallbacks;
	private alive = true;

	constructor(callbacks: PeerCallbacks) {
		this.callbacks = callbacks;
	}

	/**
	 * Initialise the PeerJS peer. Pass a customId to use a specific peer ID
	 * (hosts use the game ID as their peer ID so the share URL just works).
	 */
	async init(customId?: string): Promise<string> {
		// PeerJS only works in the browser – dynamic import guards SSR
		const { default: Peer } = await import('peerjs');

		return new Promise((resolve, reject) => {
			this.peer = customId ? new Peer(customId) : new Peer();

			this.peer.on('open', (id: string) => {
				if (!this.alive) return;
				this.callbacks.onPeerOpen?.(id);
				resolve(id);
			});

			// Host receives incoming connection from joiner
			this.peer.on('connection', (conn: unknown) => {
				if (!this.alive) return;
				this.conn = conn;
				this.setupConn(conn);
			});

			this.peer.on('error', (err: Error) => {
				this.callbacks.onError?.(err);
				reject(err);
			});
		});
	}

	/** Joiner calls this to connect to the host's peer ID */
	connectTo(remotePeerId: string): void {
		if (!this.peer) throw new Error('Peer not initialised');
		const conn = this.peer.connect(remotePeerId, { reliable: true });
		this.conn = conn;
		this.setupConn(conn);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private setupConn(conn: any): void {
		conn.on('open', () => {
			if (!this.alive) return;
			this.callbacks.onConnect?.(conn.peer as string);
		});

		conn.on('data', (data: NetworkMessage) => {
			if (!this.alive) return;
			this.callbacks.onMessage?.(data, conn.peer as string);
		});

		conn.on('close', () => {
			if (!this.alive) return;
			this.callbacks.onDisconnect?.();
		});

		conn.on('error', (err: Error) => {
			this.callbacks.onError?.(err);
		});
	}

	send(msg: NetworkMessage): void {
		if (!this.conn || !this.conn.open) {
			console.warn('[GamePeer] send called but connection not open');
			return;
		}
		this.conn.send(msg);
	}

	get peerId(): string | null {
		return this.peer?.id ?? null;
	}

	get connected(): boolean {
		return !!(this.conn?.open);
	}

	destroy(): void {
		this.alive = false;
		try { this.conn?.close(); } catch { /* ignore */ }
		try { this.peer?.destroy(); } catch { /* ignore */ }
	}
}
