<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { connectionsApi } from "$lib/api/connections";
  import type { ApiError } from "$lib/api/client";
  import { toast } from "$lib/stores/toasts.svelte";
  import { untrack } from "svelte";
  import type { ConnectionProfile, Engine } from "$lib/api/types";

  // Mounted only while editing (parent unmounts on close), so draft state below
  // initializes once per open — no stale-draft problem.
  interface Props {
    profile?: ConnectionProfile | null;
    onclose: () => void;
  }
  let { profile = null, onclose }: Props = $props();

  const DEFAULT_PORT: Record<Engine, number> = { postgres: 5432, mysql: 3306, sqlite: 0 };
  const engineOptions = [
    { value: "postgres", label: "PostgreSQL" },
    { value: "mysql", label: "MySQL / MariaDB" },
    { value: "sqlite", label: "SQLite" },
  ];

  // One-time seed from the prop (component is remounted per open, so the draft
  // never needs to react to `profile` changing). untrack marks the read intentional.
  const seed = untrack(() => profile);
  let open = $state(true);
  let name = $state(seed?.name ?? "");
  let engine = $state<Engine>(seed?.engine ?? "postgres");
  let host = $state(seed?.host ?? "localhost");
  let portStr = $state(String(seed?.port ?? DEFAULT_PORT[seed?.engine ?? "postgres"]));
  let database = $state(seed?.database ?? "");
  let username = $state(seed?.username ?? "");
  let filePath = $state(seed?.filePath ?? "");
  // Memory-only: never seeded from a saved profile (it holds no password) and
  // never written back. Blank on save leaves any existing stashed password.
  let password = $state("");
  let readOnly = $state(seed?.readOnly ?? false);
  const id = seed?.id ?? crypto.randomUUID();

  let testing = $state(false);
  let testResult = $state<{ ok: boolean; message: string } | null>(null);
  let saving = $state(false);

  const isSqlite = $derived(engine === "sqlite");
  const valid = $derived(
    name.trim().length > 0 && (isSqlite ? filePath.trim().length > 0 : host.trim().length > 0),
  );

  function onEngineChange(v: string): void {
    engine = v as Engine;
    if (v !== "sqlite" && (portStr === "" || portStr === "0")) {
      portStr = String(DEFAULT_PORT[v as Engine]);
    }
    testResult = null;
  }

  function toProfile(): ConnectionProfile {
    const p: ConnectionProfile = { id, name: name.trim(), engine, readOnly };
    if (isSqlite) {
      p.filePath = filePath.trim();
    } else {
      p.host = host.trim();
      p.port = portStr ? Number(portStr) : undefined;
      if (database.trim()) p.database = database.trim();
      if (username.trim()) p.username = username.trim();
    }
    return p;
  }

  function close(): void {
    open = false;
    onclose();
  }

  async function test(): Promise<void> {
    testing = true;
    testResult = null;
    try {
      await connectionsApi.test(toProfile(), password || undefined);
      testResult = { ok: true, message: "Connection succeeded." };
    } catch (e) {
      testResult = { ok: false, message: (e as ApiError).message };
    } finally {
      testing = false;
    }
  }

  async function save(): Promise<void> {
    saving = true;
    try {
      await connections.save(toProfile());
      if (password) connections.setSecret(id, password);
      toast.success("Connection saved.");
      close();
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      saving = false;
    }
  }
</script>

<Modal bind:open title={profile ? "Edit connection" : "New connection"} size="lg" onclose={close}>
  <div class="flex flex-col gap-3">
    <div>
      <label for="conn-name" class="mb-1 block text-xs text-fg-2">Name</label>
      <Input id="conn-name" bind:value={name} placeholder="My database" autofocus />
    </div>
    <div>
      <label for="conn-engine" class="mb-1 block text-xs text-fg-2">Engine</label>
      <Select id="conn-engine" value={engine} options={engineOptions} onchange={onEngineChange} />
    </div>

    {#if isSqlite}
      <div>
        <label for="conn-file" class="mb-1 block text-xs text-fg-2">File path</label>
        <Input id="conn-file" bind:value={filePath} placeholder="/path/to/database.sqlite" />
      </div>
    {:else}
      <div class="grid grid-cols-3 gap-2">
        <div class="col-span-2">
          <label for="conn-host" class="mb-1 block text-xs text-fg-2">Host</label>
          <Input id="conn-host" bind:value={host} placeholder="localhost" />
        </div>
        <div>
          <label for="conn-port" class="mb-1 block text-xs text-fg-2">Port</label>
          <Input id="conn-port" type="number" bind:value={portStr} />
        </div>
      </div>
      <div>
        <label for="conn-db" class="mb-1 block text-xs text-fg-2">Database</label>
        <Input id="conn-db" bind:value={database} />
      </div>
      <div>
        <label for="conn-user" class="mb-1 block text-xs text-fg-2">Username</label>
        <Input id="conn-user" bind:value={username} />
      </div>
      <div>
        <label for="conn-pass" class="mb-1 block text-xs text-fg-2">Password</label>
        <Input
          id="conn-pass"
          type="password"
          bind:value={password}
          placeholder="Kept in memory for this session only"
        />
      </div>
      <p class="text-xs text-fg-2">
        The password is held in memory only, never written to disk. TLS and SSH
        tunnel options arrive with the secrets/tunnel slice.
      </p>
    {/if}

    <Checkbox bind:checked={readOnly} label="Read-only connection" />

    {#if testResult}
      <p class="text-xs {testResult.ok ? 'text-ok' : 'text-danger'}">{testResult.message}</p>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={test} loading={testing} disabled={!valid}>Test</Button>
    <div class="flex-1"></div>
    <Button variant="ghost" onclick={close}>Cancel</Button>
    <Button variant="primary" onclick={save} loading={saving} disabled={!valid}>Save</Button>
  {/snippet}
</Modal>
