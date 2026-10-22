import { DurableObject } from 'cloudflare:workers';
import {
	parseClientMessage,
	type Avatar,
	type Card,
	type ClientMessage,
	type Round,
	type RoundVote,
	type RoomView,
	type ServerMessage
} from '../poker';

type Player = { name: string; avatar: Avatar; vote: Card | null };

type RoomData = {
	topic: string;
	revealed: boolean;
	hostId: string | null;
	players: Record<string, Player>;
	history: Round[];
};

type Attachment = { id: string };

type PlayerAction = Exclude<ClientMessage, { type: 'join' }>;

const STORAGE_KEY = 'room';

/** How long the host can be away before the role passes to another player, so a page refresh doesn't cost them the role. */
const HOST_GRACE_MS = 15_000;

/**
 * One Durable Object per room. Holds the room state and pushes updates to every
 * connected WebSocket. Each socket gets its own view, so votes stay hidden until
 * the round is revealed.
 */
export class Room extends DurableObject<Cloudflare.Env> {
	#data: RoomData = { topic: '', revealed: false, hostId: null, players: {}, history: [] };

	constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.#data = (await ctx.storage.get<RoomData>(STORAGE_KEY)) ?? this.#data;
		});
	}

	fetch(request: Request): Response {
		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('Expected a WebSocket upgrade', { status: 426 });
		}

		const [client, server] = Object.values(new WebSocketPair());
		this.ctx.acceptWebSocket(server);
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		const msg = typeof raw === 'string' ? parseClientMessage(raw) : null;
		if (!msg) return;

		const attachment: Attachment | null = ws.deserializeAttachment();
		const { players } = this.#data;

		if (msg.type === 'join') {
			ws.serializeAttachment({ id: msg.id } satisfies Attachment);
			const player = (players[msg.id] ??= { name: msg.name, avatar: msg.avatar, vote: null });
			player.name = msg.name;
			player.avatar = msg.avatar;
			this.#data.hostId ??= msg.id;
		} else {
			if (!attachment || !players[attachment.id]) return;
			this.#act(attachment.id, msg);
		}

		await this.#save();
		this.#broadcast();
	}

	async webSocketClose(ws: WebSocket) {
		await this.#disconnect(ws);
	}

	async webSocketError(ws: WebSocket) {
		await this.#disconnect(ws);
	}

	async alarm() {
		const online = this.#onlineIds();
		const { hostId, players } = this.#data;
		if (hostId !== null && online.has(hostId)) return;

		this.#data.hostId = Object.keys(players).find((id) => online.has(id)) ?? null;
		await this.#save();
		this.#broadcast();
	}

	async #disconnect(ws: WebSocket) {
		ws.close();

		const attachment: Attachment | null = ws.deserializeAttachment();
		if (attachment && attachment.id === this.#data.hostId) {
			if (!this.#onlineIds(ws).has(attachment.id)) {
				await this.ctx.storage.setAlarm(Date.now() + HOST_GRACE_MS);
			}
		}
		this.#broadcast(ws);
	}

	#act(id: string, msg: PlayerAction) {
		const data = this.#data;
		const isHost = id === data.hostId;

		switch (msg.type) {
			case 'vote':
				if (!data.revealed) data.players[id].vote = msg.card;
				break;
			case 'topic':
				data.topic = msg.topic;
				break;
			case 'reveal': {
				const votes = this.#votes();
				if (!isHost || data.revealed || votes.length === 0) break;

				data.revealed = true;
				data.history.push({
					id: data.history.length + 1,
					topic: data.topic,
					revealedAt: Date.now(),
					votes
				});
				break;
			}
			case 'reset': {
				if (!isHost) break;

				// Offline players are dropped so the table doesn't fill up with stale entries.
				// They are re-added automatically when they reconnect.
				const online = this.#onlineIds();
				data.revealed = false;
				data.topic = '';
				for (const [playerId, player] of Object.entries(data.players)) {
					if (online.has(playerId)) player.vote = null;
					else delete data.players[playerId];
				}
				break;
			}
		}
	}

	#votes(): RoundVote[] {
		return Object.values(this.#data.players).flatMap((p) =>
			p.vote === null ? [] : [{ name: p.name, avatar: p.avatar, card: p.vote }]
		);
	}

	#onlineIds(except?: WebSocket): Set<string> {
		const ids = new Set<string>();
		for (const ws of this.ctx.getWebSockets()) {
			if (ws === except) continue;
			const attachment: Attachment | null = ws.deserializeAttachment();
			if (attachment) ids.add(attachment.id);
		}
		return ids;
	}

	#broadcast(except?: WebSocket) {
		const online = this.#onlineIds(except);

		for (const ws of this.ctx.getWebSockets()) {
			if (ws === except) continue;
			const attachment: Attachment | null = ws.deserializeAttachment();
			const message: ServerMessage = {
				type: 'state',
				room: this.#view(attachment?.id ?? null, online)
			};
			try {
				ws.send(JSON.stringify(message));
			} catch {
				// The socket closed between listing and sending; its close handler will clean up.
			}
		}
	}

	#view(viewer: string | null, online: Set<string>): RoomView {
		const { topic, revealed, hostId, players, history } = this.#data;

		return {
			you: viewer,
			isHost: viewer !== null && viewer === hostId,
			topic,
			revealed,
			history,
			players: Object.entries(players).map(([id, player]) => ({
				id,
				name: player.name,
				avatar: player.avatar,
				online: online.has(id),
				isHost: id === hostId,
				hasVoted: player.vote !== null,
				vote: revealed || id === viewer ? player.vote : null
			}))
		};
	}

	async #save() {
		await this.ctx.storage.put(STORAGE_KEY, this.#data);
	}
}
