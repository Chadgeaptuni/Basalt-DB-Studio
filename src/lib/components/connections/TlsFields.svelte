<script lang="ts">
  import Field from "$lib/components/ui/Field.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import PathField from "./PathField.svelte";
  import type { SslMode, TlsConfig } from "$lib/api/types";

  // The Postgres TLS ladder, which the backend maps onto each engine. No block
  // at all is the engines' own default: TLS when the server offers it.
  interface Props {
    tls: TlsConfig | undefined;
  }
  let { tls = $bindable() }: Props = $props();

  const MODES = [
    { value: "", label: "Default — TLS if offered" },
    { value: "disable", label: "Disable" },
    { value: "require", label: "Require, no certificate check" },
    { value: "verify-ca", label: "Verify the CA" },
    { value: "verify-full", label: "Verify the CA and host name" },
  ];

  function setMode(mode: string): void {
    tls = mode ? { ...tls, mode: mode as SslMode } : undefined;
  }

  // "" and undefined are one state: an empty path is no path.
  const path = (key: "caCertPath" | "clientCertPath" | "clientKeyPath") => ({
    get: () => tls?.[key] ?? "",
    set: (v: string) => tls && (tls[key] = v.trim() || undefined),
  });
  const ca = path("caCertPath");
  const cert = path("clientCertPath");
  const key = path("clientKeyPath");
</script>

<Field label="TLS">
  <Select label="TLS" value={tls?.mode ?? ""} options={MODES} onchange={setMode} />
</Field>

{#if tls && tls.mode !== "disable"}
  {#if tls.mode.startsWith("verify")}
    <PathField label="CA certificate" bind:value={ca.get, ca.set} placeholder="PEM file; blank uses the system roots" />
  {/if}
  <div class="grid grid-cols-2 gap-2">
    <PathField label="Client certificate" bind:value={cert.get, cert.set} placeholder="Optional" />
    <PathField label="Client key" bind:value={key.get, key.set} placeholder="Optional" />
  </div>
{/if}
