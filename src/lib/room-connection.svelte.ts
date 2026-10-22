import type { ClientMessage, Profile, RoomView, ServerMessage } from './poker';

export class RoomConnection {
	view = $state<RoomView | null>(null);
	status = $state<'connecting' | 'open' | 'closed'>('connecting');

	readonly #roomId: string;
	readonly #clientId: string;
	#profile: Profile;
	#socket: WebSocket | null = null;
	#pending: ClientMessage[] = [];
	#retries = 0;
	#retryTimer: ReturnType<typeof setTimeout> | undefined;
	#closed = false;

	constructor(roomId: string, clientId: string, profile: Profile) {
		this.#roomId = roomId;
		this.#clientId = clientId;
		this.#profile = profile;
	}

	connect() {
		this.#closed = false;
		this.status = 'connecting';

		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		const socket = new WebSocket(`${protocol}//${location.host}/api/rooms/${this.#roomId}/ws`);
		this.#socket = socket;

		socket.onopen = () => {
			this.#retries = 0;
			this.status = 'open';
			this.send(this.#joinMessage());
			for (const message of this.#pending.splice(0)) this.send(message);
		};

		socket.onmessage = (event) => {
			const message = JSON.parse(event.data) as ServerMessage;
			if (message.type === 'state') this.view = message.room;
		};

		socket.onclose = () => {
			this.status = 'closed';
			if (!this.#closed) this.#scheduleReconnect();
		};
	}

	setProfile(profile: Profile) {
		this.#profile = profile;
		this.send(this.#joinMessage());
	}

	send(message: ClientMessage) {
		if (this.#socket?.readyState === WebSocket.OPEN) {
			this.#socket.send(JSON.stringify(message));
		} else if (this.#pending.length < 50) {
			// Hold actions taken while reconnecting and replay them once rejoined.
			this.#pending.push(message);
		}
	}

	close() {
		this.#closed = true;
		clearTimeout(this.#retryTimer);
		this.#socket?.close();
	}

	#joinMessage(): ClientMessage {
		return { type: 'join', id: this.#clientId, ...this.#profile };
	}

	#scheduleReconnect() {
		const delay = Math.min(1000 * 2 ** this.#retries, 10_000);
		this.#retries += 1;
		this.#retryTimer = setTimeout(() => this.connect(), delay);
	}
}
