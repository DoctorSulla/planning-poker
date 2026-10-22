# Planning Poker

A small real-time planning poker app. Create a room, share the link, and everyone estimates from their own device. Votes stay hidden until you reveal them.

- **Frontend:** SvelteKit (Svelte 5) with Tailwind
- **Backend:** Cloudflare Workers, with one Durable Object per room
- **Realtime:** WebSockets to the room's Durable Object. Each player gets their own view, so votes aren't visible before reveal.
- **State:** Stored in the Durable Object's SQLite-backed storage, so rooms survive restarts and evictions.

## Running locally

```sh
pnpm install
pnpm dev
```

`pnpm dev` builds the app and runs it with `wrangler dev`, which is the only way to exercise Durable Objects locally. Open <http://localhost:8787> in two browser windows to try it out.

`pnpm dev:ui` runs Vite's dev server for UI-only work. Rooms won't sync in that mode.

## Deploying

```sh
npx wrangler login
pnpm deploy
```

This builds the app and deploys the Worker, its static assets, and the `Room` Durable Object (SQLite-backed, migration `v1`). The first deploy creates the Durable Object namespace automatically.

## How it's wired

- `src/lib/poker.ts` holds the deck, the message protocol, input parsing, and vote summary logic. Both client and server import it.
- `src/lib/server/room.ts` is the `Room` Durable Object. It holds the room state, applies actions, and broadcasts a per-player view.
- `src/routes/api/rooms/[id]/ws/+server.ts` upgrades the request to a WebSocket and forwards it to that room's Durable Object.
- `src/lib/room-connection.svelte.ts` is the browser client. It reconnects with backoff and queues actions taken while offline.
- `vite.config.ts` wraps `adapter-cloudflare`. The adapter generates the Worker entry without Durable Object exports, so the wrapper appends the `Room` export to it.

## Roles and rounds

- The first player to join a room is its **host**. Only the host can reveal cards and start a new round. Everyone else votes and can edit the topic.
- If the host is away for more than 15 seconds, the host role passes to the longest-connected online player. A quick refresh doesn't trigger this.
- Each reveal is saved to the room's **history**, with the topic, each player's avatar and vote, and the average. Starting a new round clears the topic and votes.
- Players choose one of sixteen avatars. Changing the avatar or name rejoins the room under the same identity.

Player identity is a random ID kept in `localStorage`. Reconnecting or refreshing keeps your vote, name, and avatar. Players who are offline are shown dimmed, and they're removed from the table on the next "New round" if they're still offline.

## Tests

```sh
pnpm vitest --run --project server   # protocol parsing and vote summary
pnpm check                        # type checks
pnpm lint
```

The browser test from the original scaffold (`src/lib/vitest-examples`) needs a Playwright browser installed and isn't related to the app.
