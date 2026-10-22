<script lang="ts">
	type Props = {
		value?: string | null;
		faceDown?: boolean;
		selected?: boolean;
		label?: string;
		onclick?: () => void;
	};

	let { value = null, faceDown = false, selected = false, label, onclick }: Props = $props();
</script>

<button
	type="button"
	aria-label={label}
	aria-pressed={onclick ? selected : undefined}
	disabled={!onclick}
	{onclick}
	class="flex h-24 w-16 shrink-0 items-center justify-center rounded-xl border-2 text-2xl font-semibold shadow-sm transition
		disabled:cursor-default
		{selected ? '-translate-y-2 border-blue-600 bg-blue-50 shadow-lg ring-2 ring-blue-300' : ''}
		{faceDown
		? 'border-blue-700 bg-linear-to-br from-blue-500 to-blue-700 text-transparent'
		: value
			? 'border-slate-300 bg-white text-slate-900'
			: 'border-dashed border-slate-300 bg-transparent text-transparent'}
		{onclick ? 'hover:-translate-y-1 hover:shadow-md' : ''}"
>
	{#if !faceDown && value}
		{value}
	{:else if faceDown}
		<span class="text-white/60">✦</span>
	{/if}
</button>
