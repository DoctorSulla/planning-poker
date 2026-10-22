<script lang="ts">
	import { AVATARS, type Avatar } from '../poker';

	let { value = $bindable() }: { value: Avatar } = $props();
</script>

<div class="flex flex-wrap gap-2" role="group" aria-label="Avatar">
	{#each AVATARS as avatar (avatar)}
		<button
			type="button"
			aria-label={`Avatar ${avatar}`}
			aria-pressed={value === avatar}
			onclick={() => (value = avatar)}
			class="flex size-11 items-center justify-center rounded-full border-2 text-2xl transition {value ===
			avatar
				? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
				: 'border-slate-200 bg-white hover:bg-slate-50'}"
		>
			{avatar}
		</button>
	{/each}
</div>
