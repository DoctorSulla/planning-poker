<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import AvatarPicker from '#lib/components/AvatarPicker.svelte';
	import { getAvatar, getName, randomRoomId, saveAvatar, saveName } from '#lib/identity.ts';
	import {
		AVATARS,
		MAX_NAME_LENGTH,
		normalizeName,
		ROOM_ID_PATTERN,
		type Avatar
	} from '#lib/poker.ts';

	let name = $state('');
	let avatar = $state<Avatar>(AVATARS[0]);
	let code = $state('');
	let error = $state('');

	onMount(() => {
		name = getName();
		avatar = getAvatar();
	});

	function rememberProfile(): boolean {
		const cleaned = normalizeName(name);
		if (!cleaned) {
			error = 'Enter your name first.';
			return false;
		}
		saveName(cleaned);
		saveAvatar(avatar);
		name = cleaned;
		return true;
	}

	function createRoom() {
		error = '';
		if (rememberProfile()) goto(resolve('/room/[id]', { id: randomRoomId() }));
	}

	function joinRoom(event: SubmitEvent) {
		event.preventDefault();
		error = '';

		// Accept either a bare room code or a pasted invite link.
		const id = code.trim().split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
		if (!rememberProfile()) return;
		if (!ROOM_ID_PATTERN.test(id)) {
			error = "That room code doesn't look right.";
			return;
		}
		goto(resolve('/room/[id]', { id }));
	}
</script>

<svelte:head>
	<title>Planning Poker</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
	<div class="text-center">
		<h1 class="text-3xl font-bold">Planning Poker</h1>
		<p class="mt-2 text-slate-500">Estimate together, from any device.</p>
	</div>

	<div class="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow">
		<label class="flex flex-col gap-1 text-sm font-medium">
			Your name
			<input
				bind:value={name}
				maxlength={MAX_NAME_LENGTH}
				placeholder="e.g. Ada"
				class="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-blue-500 focus:outline-none"
			/>
		</label>

		<div class="flex flex-col gap-2 text-sm font-medium">
			Avatar
			<AvatarPicker bind:value={avatar} />
		</div>

		<button
			type="button"
			onclick={createRoom}
			class="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
		>
			Start a new room
		</button>

		<div class="flex items-center gap-3 text-xs tracking-wide text-slate-400 uppercase">
			<hr class="flex-1 border-slate-200" />
			or join one
			<hr class="flex-1 border-slate-200" />
		</div>

		<form onsubmit={joinRoom} class="flex gap-2">
			<input
				bind:value={code}
				placeholder="Room code or invite link"
				class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono focus:border-blue-500 focus:outline-none"
			/>
			<button
				type="submit"
				class="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
			>
				Join
			</button>
		</form>

		{#if error}
			<p class="text-sm text-red-600">{error}</p>
		{/if}
	</div>
</main>
