<script lang="ts">
  import Plug from "@lucide/svelte/icons/plug";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Database from "@lucide/svelte/icons/database";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import AccordionSection from "$lib/components/ui/AccordionSection.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ConnectionForm from "./ConnectionForm.svelte";
  import ConnectionRow from "./ConnectionRow.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import type { ConnectionProfile, ErrorKind } from "$lib/api/types";

  // Kind-specific, actionable headings for connect failures (DESIGN §8) — the
  // backend message follows below. secretNotFound/keychainUnavailable/vaultLocked
  // land here once the secrets slice can produce them.
  const CONNECT_TITLE: Partial<Record<ErrorKind, string>> = {
    connectionRefused: "Can't reach the server",
    authFailed: "Authentication failed — check user/password",
    tlsError: "TLS error — check SSL mode and certificates",
    tunnelError: "SSH tunnel failed — check the tunnel settings",
    secretNotFound: "No stored password — edit the connection to add one",
    keychainUnavailable: "OS keychain unavailable",
    vaultLocked: "Vault is locked",
    configParse: "Connection file is malformed",
  };
  const connectTitle = (k: ErrorKind): string => CONNECT_TITLE[k] ?? "Connection error";

  let form = $state<{ profile: ConnectionProfile | null } | null>(null);

  $effect(() => {
    void connections.load();
  });

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

<AccordionSection id="connections" title="Connections">
  {#snippet actions()}
    <IconButton icon={Plug} title="New connection" size="sm" onclick={() => (form = { profile: null })} />
  {/snippet}

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
          <li>
            <ConnectionRow
              profile={p}
              selected={!!st.session && connections.active?.sessionId === st.session.sessionId}
              onclick={() => selectRow(p)}
            >
              {#snippet actions()}
                <IconButton
                  icon={st.status === "connected" ? Unplug : Plug}
                  title={st.status === "connected" ? "Disconnect" : "Connect"}
                  size="sm"
                  onclick={() => toggle(p)}
                />
                <IconButton icon={Pencil} title="Edit" size="sm" onclick={() => (form = { profile: p })} />
                <IconButton icon={Trash2} title="Delete" size="sm" onclick={() => del(p)} />
              {/snippet}
            </ConnectionRow>
            {#if st.status === "error" && st.error}
              <div class="flex items-start gap-2 bg-danger-bg px-3 py-1.5 text-xs text-danger">
                <div class="min-w-0 flex-1">
                  <div class="font-medium">{connectTitle(st.error.kind)}</div>
                  <div class="mt-0.5 font-mono text-[11px] break-words opacity-90">{st.error.message}</div>
                </div>
                <IconButton icon={RotateCw} title="Retry" size="sm" onclick={() => connections.connect(p.id)} />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</AccordionSection>

{#if form}
  <ConnectionForm profile={form.profile} onclose={() => (form = null)} />
{/if}
