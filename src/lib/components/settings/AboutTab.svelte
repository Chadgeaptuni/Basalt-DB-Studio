<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Button from "$lib/components/ui/Button.svelte";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import SettingsGroup from "./SettingsGroup.svelte";
  import { appInfoApi } from "$lib/api/appInfo";
  import type { ApiError } from "$lib/api/client";
  import type { AppInfo } from "$lib/api/types";
  import { deviceInfo } from "$lib/utils/device";
  import { formatDiagnostics } from "$lib/utils/diagnostics";
  import { copyText } from "$lib/utils/copy";
  import { toast } from "$lib/stores/toasts.svelte";

  // What is running, and on what. Written for the moment someone is filing an
  // issue: every value is exact, nothing is inferred, and the whole set copies as
  // one block so it can be pasted rather than transcribed.
  //
  // No OS version anywhere. It cannot be read without another crate, and the free
  // sources lie — see `commands/app_info.rs`. A field that is confidently wrong is
  // worse in a bug report than a field that is absent.
  let info = $state<AppInfo | null>(null);
  let loadError = $state<ApiError | null>(null);
  let copied = $state(false);

  // Synchronous and never fails, so it needs no state of its own.
  const device = deviceInfo();

  async function load(): Promise<void> {
    loadError = null;
    try {
      info = await appInfoApi.get();
    } catch (e) {
      loadError = e as ApiError;
    }
  }

  $effect(() => {
    void load();
  });

  async function copyDiagnostics(): Promise<void> {
    if (!info) return;
    try {
      await copyText(formatDiagnostics(info, device));
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // The clipboard is the one thing here that can be denied by the OS, and
      // silently doing nothing would look like the button is broken.
      toast.error("Couldn't reach the clipboard");
    }
  }
</script>

{#snippet fact(label: string, value: string)}
  <div class="flex items-center justify-between gap-4 px-3.5 py-2.5">
    <span class="shrink-0 text-body-sm text-on-surface-variant">{label}</span>
    <span class="min-w-0 truncate text-right text-data text-on-surface-muted" title={value}>
      {value}
    </span>
  </div>
{/snippet}

{#if loadError}
  <div class="overflow-hidden rounded-sm">
    <ErrorState kind={loadError.kind} message={loadError.message} filled>
      {#snippet action()}
        <Button variant="text-error" size="sm" onclick={() => void load()}>Retry</Button>
      {/snippet}
    </ErrorState>
  </div>
{:else if !info}
  <div class="flex items-center gap-2 text-body-md text-on-surface-muted">
    <Spinner size="sm" /> Loading…
  </div>
{:else}
  <div class="flex flex-col gap-6">
    <!-- Identity, not a hero: left-aligned, and the largest thing on it is a
         `text-title-md` the dialog already uses for its own header (DESIGN §4). -->
    <div class="flex items-start gap-4">
      <BrandMark size={44} class="mt-0.5 shrink-0 text-on-surface" />
      <div class="flex min-w-0 flex-col items-start gap-2">
        <div class="flex items-center gap-2">
          <h2 class="text-title-md text-on-surface">{info.name}</h2>
          <span class="text-data text-on-surface-muted">{info.version}</span>
          {#if info.debug}
            <!-- Worth stating plainly: a debug build's timings and bundle size
                 are nothing like the release someone would otherwise assume. -->
            <Badge variant="warn">debug</Badge>
          {/if}
        </div>
        <p class="text-body-sm text-on-surface-muted">
          A lightweight, keyboard-driven database GUI. Free software under the
          GNU General Public License v3.
        </p>
        <Button variant="tonal" size="sm" onclick={() => void copyDiagnostics()}>
          <Copy size={14} strokeWidth={2} />
          {copied ? "Copied" : "Copy diagnostics"}
        </Button>
      </div>
    </div>

    <SettingsGroup title="Application">
      {@render fact("Version", info.version)}
      {@render fact("Build", info.debug ? "debug" : "release")}
      {@render fact("Identifier", info.identifier)}
      {@render fact("Tauri", info.tauriVersion)}
      {@render fact("Webview", info.webviewVersion ?? "unreported")}
      <!-- The folder the Git panel is a client for. Nothing else in the app
           says where it is, which makes git-sync hard to reason about. -->
      {@render fact("Config directory", info.configDir)}
    </SettingsGroup>

    <SettingsGroup title="Device">
      {@render fact("Operating system", info.osName)}
      <!-- Separate from the name because they answer different questions:
           "Windows 11" is what the user recognises, `10.0.26200` is what matches
           a vendor changelog. Showing only the number is how an app ends up
           looking like it thinks Windows 11 is Windows 10. -->
      {@render fact("OS build", info.osVersion ?? "unreported")}
      {@render fact("Architecture", info.arch)}
      <!-- The target triple, not the user agent: what the binary was built for,
           which differs from the machine under emulation. -->
      {@render fact("Build target", `${info.os}-${info.arch} (${info.family})`)}
      {@render fact("Locale", device.locale)}
      {@render fact("Display", device.display)}
    </SettingsGroup>

    <!-- The GPL's own appendix asks for this notice, and names an about box as
         where a GUI should put it. -->
    <SettingsGroup title="Legal">
      {@render fact("License", "GPL-3.0-only")}
      <p class="px-3.5 py-2.5 text-body-sm text-on-surface-muted">
        This program comes with absolutely no warranty. It is free software, and you are
        welcome to redistribute it under the terms of the GNU General Public License,
        version 3, as published by the Free Software Foundation.
      </p>
    </SettingsGroup>
  </div>
{/if}
