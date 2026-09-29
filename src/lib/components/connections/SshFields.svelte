<script lang="ts">
  import Field from "$lib/components/ui/Field.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import PathField from "./PathField.svelte";
  import type { SshAuthKind, SshConfig } from "$lib/api/types";

  // An SSH bastion in front of the database. The host and port above are then
  // the database's address as the bastion sees it. `secret` is the SSH password
  // or the key's passphrase; it goes where the database password goes.
  interface Props {
    ssh: SshConfig | undefined;
    secret: string;
  }
  let { ssh = $bindable(), secret = $bindable() }: Props = $props();

  const AUTH = [
    { value: "agent", label: "SSH agent" },
    { value: "key", label: "Private key" },
    { value: "password", label: "Password" },
  ];

  const enabled = {
    get: () => Boolean(ssh),
    set: (on: boolean) => (ssh = on ? { host: "", port: 22, user: "", authKind: "agent" } : undefined),
  };
  const port = {
    get: () => String(ssh?.port ?? 22),
    set: (v: string) => ssh && (ssh.port = Number(v) || 22),
  };
  const keyPath = {
    get: () => ssh?.keyPath ?? "",
    set: (v: string) => ssh && (ssh.keyPath = v.trim() || undefined),
  };
</script>

<Checkbox bind:checked={enabled.get, enabled.set} label="Connect through an SSH tunnel" />

{#if ssh}
  <div class="grid grid-cols-3 gap-2">
    <div class="col-span-2">
      <Field label="SSH host"><Input bind:value={ssh.host} placeholder="bastion.example.com" /></Field>
    </div>
    <Field label="SSH port"><Input type="number" bind:value={port.get, port.set} /></Field>
  </div>
  <div class="grid grid-cols-2 gap-2">
    <Field label="SSH user"><Input bind:value={ssh.user} /></Field>
    <Field label="Authentication">
      <Select
        label="Authentication"
        value={ssh.authKind}
        options={AUTH}
        onchange={(v) => ssh && (ssh.authKind = v as SshAuthKind)}
      />
    </Field>
  </div>
  {#if ssh.authKind === "key"}
    <PathField label="Private key" bind:value={keyPath.get, keyPath.set} placeholder="~/.ssh/id_ed25519" />
  {/if}
  {#if ssh.authKind !== "agent"}
    <Field
      label={ssh.authKind === "key" ? "Key passphrase" : "SSH password"}
      hint={ssh.authKind === "key" ? "Blank for a key without one." : undefined}
    >
      <Input type="password" bind:value={secret} />
    </Field>
  {/if}
{/if}
