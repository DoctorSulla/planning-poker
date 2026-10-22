<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import AvatarPicker from '#lib/components/AvatarPicker.svelte';
	import PokerCard from '#lib/components/PokerCard.svelte';
	import { getAvatar, getClientId, getName, saveAvatar, saveName } from '#lib/identity.ts';
	import {
		AVATARS,
		DECK,
		MAX_NAME_LENGTH,
		MAX_TOPIC_LENGTH,
		normalizeName,
		summarize,
		type Card,
		type Profile
	} from '#lib/poker.ts';
	import { RoomConnection } from '#lib/room-connection.svelte.ts';

	// null until mounted, so server-rendered output doesn't read localStorage.
	let profile = $state<Profile | null>(null);
	let draft = $state<Profile>({ name: '', avatar: AVATARS[0] });
	let editing = $state(false);
	let connection = $state<RoomConnection>();
	let copied = $state(false);

	const roomId = $derived(page.params.id ?? '');
	const joined = $derived(Boolean(profile?.name));
	const view = $derived(connection?.view ?? null);
	const myVote = $derived(view?.players.find((p) => p.id === view?.you)?.vote ?? null);
	const votesCast = $derived(view?.players.filter((p) => p.hasVoted).length ?? 0);
	const summary = $derived(view ? summarize(view.players.map((p) => p.vote)) : null);
	const host = $derived(view?.players.find((p) => p.isHost));

	onMount(() => {
		profile = { name: getName(), avatar: getAvatar() };
		draft = { ...profile };
	});

	$effect(() => {
		if (!joined) return;

		const current = untrack(() => profile);
		if (!current) return;

		const room = new RoomConnection(roomId, getClientId(), current);
		room.connect();
		connection = room;
		return () => room.close();
	});

	function startEditing() {
		if (profile) draft = { ...profile };
		editing = true;
	}

	function submitProfile(event: SubmitEvent) {
		event.preventDefault();
		const name = normalizeName(draft.name);
		if (!name) return;

		const next: Profile = { name, avatar: draft.avatar };
		saveName(next.name);
		saveAvatar(next.avatar);

		const wasJoined = joined;
		profile = next;
		if (wasJoined) connection?.setProfile(next);
		editing = false;
	}

	function castVote(card: Card) {
		connection?.send({ type: 'vote', card: card === myVote ? null : card });
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(location.href);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard access is unavailable on some non-HTTPS origins.
		}
	}

	function format(value: number | null): string {
		return value === null ? '—' : String(Math.round(value * 10) / 10);
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

{#snippet stat(label: string, value: string)}
	<div class="flex flex-col">
		<span class="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
		<span class="text-2xl font-semibold">{value}</span>
	</div>
{/snippet}

{#snippet profileFields()}
	<label class="flex flex-col gap-1 text-sm font-medium">
		Your name
		<input
			bind:value={draft.name}
			maxlength={MAX_NAME_LENGTH}
			required
			class="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-blue-500 focus:outline-none"
		/>
	</label>
	<div class="flex flex-col gap-2 text-sm font-medium">
		Avatar
		<AvatarPicker bind:value={draft.avatar} />
	</div>
{/snippet}

<svelte:head>
	<title>Room {roomId} · Planning Poker</title>
</svelte:head>

<div class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
	{#if profile === null}
		<p class="text-slate-500">Loading…</p>
	{:else if !joined}
		<form
			onsubmit={submitProfile}
			class="mx-auto mt-16 flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow"
		>
			<h1 class="text-xl font-semibold">
				Join room <span class="font-mono">{roomId}</span>
			</h1>
			{@render profileFields()}
			<button
				type="submit"
				class="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
			>
				Join
			</button>
		</form>
	{:else if view && connection}
		<header class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-lg font-semibold">
					Room <span class="font-mono">{roomId}</span>
				</h1>
				<p class="flex items-center gap-2 text-sm text-slate-500">
					<span
						class="inline-block size-2 rounded-full {connection.status === 'open'
							? 'bg-green-500'
							: 'bg-amber-500'}"
					></span>
					{connection.status === 'open' ? 'Connected' : 'Reconnecting…'} as {profile?.avatar}
					{profile?.name}{view.isHost ? ' · host' : ''}
				</p>
			</div>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={startEditing}
					class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
				>
					Edit profile
				</button>
				<button
					type="button"
					onclick={copyLink}
					class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
				>
					{copied ? 'Link copied!' : 'Copy invite link'}
				</button>
			</div>
		</header>

		{#if editing}
			<form
				onsubmit={submitProfile}
				class="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm"
			>
				{@render profileFields()}
				<div class="flex gap-2">
					<button
						type="submit"
						class="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
					>
						Save
					</button>
					<button
						type="button"
						onclick={() => (editing = false)}
						class="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
					>
						Cancel
					</button>
				</div>
			</form>
		{/if}

		<input
			value={view.topic}
			maxlength={MAX_TOPIC_LENGTH}
			placeholder="What are we estimating? (e.g. PROJ-123 login flow)"
			onchange={(e) => connection?.send({ type: 'topic', topic: e.currentTarget.value })}
			class="rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
		/>

		<section>
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
				Table · {votesCast} of {view.players.length} voted
			</h2>
			<div class="flex flex-wrap gap-5">
				{#each view.players as player (player.id)}
					{@const isMe = player.id === view.you}
					{@const showValue = view.revealed || isMe}
					<div
						class="flex w-24 flex-col items-center gap-2 transition-opacity {player.online
							? ''
							: 'opacity-40'}"
					>
						<PokerCard
							value={showValue ? player.vote : null}
							faceDown={!showValue && player.hasVoted}
							label={`${player.name} vote`}
						/>
						<div class="flex w-full flex-col items-center">
							<span class="w-full truncate text-center text-sm {isMe ? 'font-semibold' : ''}">
								<span aria-hidden="true">{player.avatar}</span>
								{player.name}{isMe ? ' (you)' : ''}
							</span>
							{#if player.isHost}
								<span class="text-xs font-semibold tracking-wide text-blue-700 uppercase">Host</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>

		<section class="flex flex-col gap-6">
			{#if view.revealed && summary}
				<div class="flex flex-wrap items-end gap-8 rounded-2xl bg-white p-5 shadow-sm">
					{@render stat('Average', format(summary.average))}
					{@render stat('Lowest', format(summary.min))}
					{@render stat('Highest', format(summary.max))}
					{#if summary.unanimous}
						<p class="font-semibold text-green-700">Consensus! 🎉</p>
					{/if}
				</div>
			{/if}

			<div class="flex flex-wrap justify-center gap-2 sm:gap-3">
				{#each DECK as card (card)}
					<PokerCard
						value={card}
						selected={myVote === card}
						label={`Vote ${card}`}
						onclick={view.revealed ? undefined : () => castVote(card)}
					/>
				{/each}
			</div>

			{#if view.isHost}
				<div class="flex justify-center gap-3">
					<button
						type="button"
						onclick={() => connection?.send({ type: 'reveal' })}
						disabled={view.revealed || votesCast === 0}
						class="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
					>
						Reveal cards
					</button>
					<button
						type="button"
						onclick={() => connection?.send({ type: 'reset' })}
						class="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold hover:bg-slate-50"
					>
						New round
					</button>
				</div>
			{:else}
				<p class="text-center text-sm text-slate-500">
					{#if view.revealed}
						Waiting for {host?.name ?? 'the host'} to start the next round.
					{:else}
						Waiting for {host?.name ?? 'the host'} to reveal the cards.
					{/if}
				</p>
			{/if}
		</section>

		{#if view.history.length > 0}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">History</h2>
				<ol class="flex flex-col gap-3">
					{#each [...view.history].reverse() as round (round.id)}
						{@const roundSummary = summarize(round.votes.map((v) => v.card))}
						<li class="rounded-xl bg-white p-4 shadow-sm">
							<div class="flex flex-wrap items-baseline justify-between gap-2">
								<span class="font-medium">{round.topic || 'Untitled'}</span>
								<span class="text-xs text-slate-500">
									#{round.id} · {formatTime(round.revealedAt)}
								</span>
							</div>
							<div class="mt-2 flex flex-wrap gap-2">
								{#each round.votes as vote, i (i)}
									<span
										class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm"
									>
										<span aria-hidden="true">{vote.avatar}</span>
										<span class="text-slate-600">{vote.name}</span>
										<span class="font-semibold">{vote.card}</span>
									</span>
								{/each}
							</div>
							<p class="mt-2 text-sm text-slate-500">
								Average {format(roundSummary.average)}{roundSummary.unanimous ? ' · consensus' : ''}
							</p>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{:else}
		<p class="text-slate-500">Connecting…</p>
	{/if}
</div>
