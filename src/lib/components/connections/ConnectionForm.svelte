<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import { ENVIRONMENTS, envLabel } from "$lib/utils/environment";
  import { connections } from "$lib/stores/connections.svelte";
  import { connectionsApi } from "$lib/api/connections";
  import type { ApiError } from "$lib/api/client";
  import { toast } from "$lib/stores/toasts.svelte";
  import { untrack } from "svelte";
  import type { ConnectionProfile, Engine, Environment } from "$lib/api/types";

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
  // Never seeded: the profile holds no password. Blank on save keeps a saved one.
  let password = $state("");
  const saved = Boolean(seed?.secretRef);
  let remember = $state(seed ? saved : true);
  let readOnly = $state(seed?.readOnly ?? false);
  // "" is untagged, which is distinct from `local` — see utils/environment.ts.
  let environment = $state<Environment | "">(seed?.environment ?? "");
  const environmentOptions = [
    { value: "", label: "Untagged" },
    ...ENVIRONMENTS.map((e) => ({ value: e, label: envLabel(e) })),
  ];
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
    const p: ConnectionProfile = { id, name: name.trim(), engine, readOnly, secretRef: seed?.secretRef };
    // Omitted rather than sent as "" — the profile TOML has no key for untagged.
    if (environment) p.environment = environment;
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
      await connections.save(toProfile(), { password: password || undefined }, remember);
      toast.success("Connection saved.");
      close();
    } catch (e) {
      toast.fromError(e, "Couldn't save the connection");
    } finally {
      saving = false;
    }
  }
</script>

<Modal bind:open title={profile ? "Edit connection" : "New connection"} size="lg" onclose={close}>
  <div class="flex flex-col gap-3">
    <Field label="Name">
      <Input bind:value={name} placeholder="My database" autofocus />
    </Field>
    <Field label="Engine">
      <Select label="Engine" value={engine} options={engineOptions} onchange={onEngineChange} />
    </Field>

    <!-- Environment lives in the profile, so every surface that names the
         connection can warn from it. -->
    <Field label="Environment" hint="Production connections name themselves in every destructive confirmation.">
      <Select
        label="Environment"
        value={environment ?? ""}
        options={environmentOptions}
        onchange={(v) => (environment = v as Environment | "")}
      />
    </Field>

    {#if isSqlite}
      <Field label="File path">
        <Input bind:value={filePath} placeholder="/path/to/database.sqlite" />
      </Field>
    {:else}
      <div class="grid grid-cols-3 gap-2">
        <div class="col-span-2">
          <Field label="Host"><Input bind:value={host} placeholder="localhost" /></Field>
        </div>
        <Field label="Port"><Input type="number" bind:value={portStr} /></Field>
      </div>
      <!-- Postgres cannot leave the database it connects to, so this field is the
           one the *server* is discovered over, not the one you are stuck with: the
           tree lists the rest and opens whichever you pick. Blank means
           `postgres`, which every stock server has. MySQL browses every database
           on one connection, so there the field genuinely is optional. -->
      <Field label={engine === "postgres" ? "Maintenance database" : "Database"}>
        <Input bind:value={database} placeholder={engine === "postgres" ? "postgres" : "All databases"} />
      </Field>
      <Field label="Username"><Input bind:value={username} /></Field>
      <Field
        label="Password"
        hint={saved && remember ? "Saved in the OS keychain. Leave blank to keep it." : undefined}
      >
        <Input type="password" bind:value={password} />
      </Field>
      <Checkbox bind:checked={remember} label="Save password in the OS keychain" />
    {/if}

    <Checkbox bind:checked={readOnly} label="Read-only connection" />

    {#if testResult}
      <p class="text-body-sm {testResult.ok ? 'text-ok' : 'text-error'}">{testResult.message}</p>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="text" onclick={test} loading={testing} disabled={!valid}>Test</Button>
    <div class="flex-1"></div>
    <Button variant="text" onclick={close}>Cancel</Button>
    <Button variant="filled" onclick={save} loading={saving} disabled={!valid}>Save</Button>
  {/snippet}
</Modal>
