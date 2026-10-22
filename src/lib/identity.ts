import { AVATARS, isAvatar, type Avatar } from './poker';

const NAME_KEY = 'planning-poker:name';
const AVATAR_KEY = 'planning-poker:avatar';
const CLIENT_ID_KEY = 'planning-poker:client-id';

const ROOM_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const HEX = '0123456789abcdef';

// crypto.randomUUID() is only available in secure contexts, which excludes plain-http LAN testing.
function randomString(alphabet: string, length: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function randomRoomId(): string {
	return randomString(ROOM_ALPHABET, 6);
}

export function getClientId(): string {
	let id = localStorage.getItem(CLIENT_ID_KEY);
	if (!id) {
		id = randomString(HEX, 32);
		localStorage.setItem(CLIENT_ID_KEY, id);
	}
	return id;
}

export function getName(): string {
	return localStorage.getItem(NAME_KEY) ?? '';
}

export function saveName(name: string) {
	localStorage.setItem(NAME_KEY, name);
}

export function getAvatar(): Avatar {
	const stored = localStorage.getItem(AVATAR_KEY);
	return isAvatar(stored) ? stored : AVATARS[0];
}

export function saveAvatar(avatar: Avatar) {
	localStorage.setItem(AVATAR_KEY, avatar);
}
