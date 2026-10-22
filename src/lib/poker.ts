export const DECK = ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'] as const;

export type Card = (typeof DECK)[number];

export const AVATARS = [
	'🦊',
	'🐸',
	'🐼',
	'🦄',
	'🐙',
	'🐵',
	'🤖',
	'🐧',
	'🐨',
	'🦁',
	'🐯',
	'🐢',
	'🦉',
	'🐝',
	'🦋',
	'🐥'
] as const;

export type Avatar = (typeof AVATARS)[number];

export type Profile = { name: string; avatar: Avatar };

export const MAX_NAME_LENGTH = 30;
export const MAX_TOPIC_LENGTH = 200;
export const ROOM_ID_PATTERN = /^[a-z0-9]{4,16}$/;
const CLIENT_ID_PATTERN = /^[\w-]{8,64}$/;

export type PlayerView = {
	id: string;
	name: string;
	avatar: Avatar;
	online: boolean;
	isHost: boolean;
	hasVoted: boolean;
	/** Visible to everyone once revealed, otherwise only to the player who cast it. */
	vote: Card | null;
};

export type RoundVote = { name: string; avatar: Avatar; card: Card };

export type Round = {
	id: number;
	topic: string;
	revealedAt: number;
	votes: RoundVote[];
};

export type RoomView = {
	you: string | null;
	isHost: boolean;
	topic: string;
	revealed: boolean;
	players: PlayerView[];
	history: Round[];
};

export type ClientMessage =
	| ({ type: 'join'; id: string } & Profile)
	| { type: 'vote'; card: Card | null }
	| { type: 'topic'; topic: string }
	| { type: 'reveal' }
	| { type: 'reset' };

export type ServerMessage = { type: 'state'; room: RoomView };

const NUMERIC: Partial<Record<Card, number>> = {
	'0': 0,
	'½': 0.5,
	'1': 1,
	'2': 2,
	'3': 3,
	'5': 5,
	'8': 8,
	'13': 13,
	'20': 20,
	'40': 40,
	'100': 100
};

export function isCard(value: unknown): value is Card {
	return typeof value === 'string' && (DECK as readonly string[]).includes(value);
}

export function isAvatar(value: unknown): value is Avatar {
	return typeof value === 'string' && (AVATARS as readonly string[]).includes(value);
}

export function normalizeName(name: string): string {
	return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

export function parseClientMessage(raw: string): ClientMessage | null {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof data !== 'object' || data === null) return null;
	const msg = data as Record<string, unknown>;

	switch (msg.type) {
		case 'join':
			if (typeof msg.id !== 'string' || !CLIENT_ID_PATTERN.test(msg.id)) return null;
			if (typeof msg.name !== 'string') return null;
			return {
				type: 'join',
				id: msg.id,
				name: normalizeName(msg.name) || 'Guest',
				avatar: isAvatar(msg.avatar) ? msg.avatar : AVATARS[0]
			};
		case 'vote':
			if (msg.card === null) return { type: 'vote', card: null };
			return isCard(msg.card) ? { type: 'vote', card: msg.card } : null;
		case 'topic':
			if (typeof msg.topic !== 'string') return null;
			return { type: 'topic', topic: msg.topic.trim().slice(0, MAX_TOPIC_LENGTH) };
		case 'reveal':
			return { type: 'reveal' };
		case 'reset':
			return { type: 'reset' };
		default:
			return null;
	}
}

export function summarize(cards: readonly (Card | null)[]) {
	const played = cards.filter((c): c is Card => c !== null);
	const numbers = played.map((c) => NUMERIC[c]).filter((n): n is number => n !== undefined);
	const total = numbers.reduce((sum, n) => sum + n, 0);

	return {
		average: numbers.length > 0 ? total / numbers.length : null,
		min: numbers.length > 0 ? Math.min(...numbers) : null,
		max: numbers.length > 0 ? Math.max(...numbers) : null,
		unanimous: played.length > 0 && played.every((c) => c === played[0])
	};
}
