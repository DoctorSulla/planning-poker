import { describe, expect, it } from 'vitest';
import { AVATARS, parseClientMessage, summarize } from './poker';

describe('parseClientMessage', () => {
	it('parses a vote for a card in the deck', () => {
		expect(parseClientMessage('{"type":"vote","card":"5"}')).toEqual({ type: 'vote', card: '5' });
	});

	it('parses a cleared vote', () => {
		expect(parseClientMessage('{"type":"vote","card":null}')).toEqual({ type: 'vote', card: null });
	});

	it('rejects cards that are not in the deck', () => {
		expect(parseClientMessage('{"type":"vote","card":"999"}')).toBeNull();
	});

	it('rejects malformed JSON and unknown message types', () => {
		expect(parseClientMessage('not json')).toBeNull();
		expect(parseClientMessage('null')).toBeNull();
		expect(parseClientMessage('{"type":"explode"}')).toBeNull();
	});

	it('normalises the name and keeps a valid avatar on join', () => {
		const msg = parseClientMessage(
			JSON.stringify({ type: 'join', id: 'abcdefgh1234', name: '  Ada   Lovelace ', avatar: '🐸' })
		);
		expect(msg).toEqual({ type: 'join', id: 'abcdefgh1234', name: 'Ada Lovelace', avatar: '🐸' });
	});

	it('falls back to the first avatar when the avatar is unknown', () => {
		const msg = parseClientMessage(
			JSON.stringify({ type: 'join', id: 'abcdefgh1234', name: 'Ada', avatar: '💀' })
		);
		expect(msg).toEqual({ type: 'join', id: 'abcdefgh1234', name: 'Ada', avatar: AVATARS[0] });
	});

	it('rejects a join with an invalid client id', () => {
		expect(
			parseClientMessage(JSON.stringify({ type: 'join', id: 'x', name: 'Ada', avatar: '🐸' }))
		).toBeNull();
	});
});

describe('summarize', () => {
	it('averages numeric votes and ignores special cards', () => {
		expect(summarize(['3', '5', '?', '☕', null])).toEqual({
			average: 4,
			min: 3,
			max: 5,
			unanimous: false
		});
	});

	it('counts half points', () => {
		expect(summarize(['½', '1']).average).toBe(0.75);
	});

	it('reports consensus when every vote matches', () => {
		expect(summarize(['8', '8', '8']).unanimous).toBe(true);
	});

	it('has no numeric result when only special cards were played', () => {
		expect(summarize(['?', '☕'])).toEqual({
			average: null,
			min: null,
			max: null,
			unanimous: false
		});
	});
});
