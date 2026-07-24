<script lang="ts">
  import Plug from "@lucide/svelte/icons/plug";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Database from "@lucide/svelte/icons/database";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ConnectionForm from "./ConnectionForm.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import type { ConnectionProfile, Engine } from "$lib/api/types";

  let form = $state<{ profile: ConnectionProfile | null } | null>(null);

  $effect(() => {
    void connections.load();
  });

  const ENGINE_TAG: Record<Engine, string> = { postgres: "PG", mysql: "MY", sqlite: "SQ" };
  const DOT: Record<string, string> = {
    connected: "bg-ok",
    connecting: "bg-warn",
    error: "bg-danger",
    disconnected: "bg-fg-2",
  };

  function subtitle(p: ConnectionProfile): string {
    if (p.engine === "sqlite") return p.filePath ?? "";
    return `${p.host ?? ""}${p.port ? `:${p.port}` : ""}${p.database ? `/${p.database}` : ""}`;
  }

  async function toggle(p: ConnectionProfile): Promise<void> {
    const s = connections.statusFor(p.id);
    if (s.status === "connected" && s.session) {
      connections.setActive(s.session);
      await connections.disconnect(p.id);
    } else {
      await connections.connect(p.id);
    }
  }

  function selectRow(p: ConnectionProfile): void {
    const s = connections.statusFor(p.id);
    if (s.status === "connected" && s.session) connections.setActive(s.session);
  }

  async function del(p: ConnectionProfile): Promise<void> {
    const ok = await confirm({
      title: `Delete connection “${p.name}”?`,
      message: "This removes the saved profile. The database itself is untouched.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) await connections.remove(p.id);
  }
</script>

<div class="flex h-full flex-col">
  <header class="flex h-9 items-center justify-between border-b border-border px-3">
    <span class="text-xs font-medium tracking-wider text-fg-2 uppercase">Connections</span>
    <IconButton icon={Plug} title="New connection" size="sm" onclick={() => (form = { profile: null })} />
  </header>

  <div class="flex-1 overflow-auto">
    {#if !connections.loaded}
      <div class="flex items-center gap-2 p-3 text-sm text-fg-2"><Spinner size="sm" /> Loading…</div>
    {:else if connections.loadError}
      <div class="p-3 text-sm text-danger">
        {connections.loadError.message}
        <div class="mt-2"><Button size="sm" onclick={() => connections.load()}>Retry</Button></div>
      </div>
    {:else if connections.profiles.length === 0}
      <EmptyState icon={Database} message="No connections yet">
        {#snippet action()}
          <Button size="sm" onclick={() => (form = { profile: null })}>New connection</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <ul class="divide-y divide-border">
        {#each connections.profiles as p (p.id)}
          {@const st = connections.statusFor(p.id)}
          {@const isActive = connections.active?.sessionId === st.session?.sessionId && !!st.session}
          <li>
            <div
              class="group flex h-9 items-center gap-2 px-3 text-sm transition-colors duration-150
                {isActive ? 'bg-bg-2' : 'hover:bg-bg-2'}"
            >
              <span class="h-1.5 w-1.5 shrink-0 rounded-full {DOT[st.status]}"></span>
              <Badge>{ENGINE_TAG[p.engine]}</Badge>
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                onclick={() => selectRow(p)}
                title={subtitle(p)}
              >
                <div class="truncate text-fg-0">{p.name}</div>
                <div class="truncate font-mono text-[11px] text-fg-2">{subtitle(p)}</div>
              </button>
              <div class="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
                <IconButton
                  icon={st.status === "connected" ? Unplug : Plug}
                  title={st.status === "connected" ? "Disconnect" : "Connect"}
                  size="sm"
                  onclick={() => toggle(p)}
                />
                <IconButton icon={Pencil} title="Edit" size="sm" onclick={() => (form = { profile: p })} />
                <IconButton icon={Trash2} title="Delete" size="sm" onclick={() => del(p)} />
              </div>
              {#if st.status === "connecting"}<Spinner size="sm" />{/if}
            </div>
            {#if st.status === "error" && st.error}
              <div class="flex items-start gap-2 bg-danger-bg px-3 py-1.5 text-xs text-danger">
                <span class="flex-1">{st.error.message}</span>
                <IconButton icon={RotateCw} title="Retry" size="sm" onclick={() => connections.connect(p.id)} />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

{#if form}
  <ConnectionForm profile={form.profile} onclose={() => (form = null)} />
{/if}
