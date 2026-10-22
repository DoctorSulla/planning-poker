import { env } from 'cloudflare:workers';
import { error } from '@sveltejs/kit';
import { ROOM_ID_PATTERN } from '#lib/poker.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request }) => {
	if (!ROOM_ID_PATTERN.test(params.id)) error(400, 'Invalid room id');
	if (request.headers.get('Upgrade') !== 'websocket') error(426, 'Expected a WebSocket upgrade');

	const room = env.ROOM.get(env.ROOM.idFromName(params.id));
	return room.fetch(request);
};
