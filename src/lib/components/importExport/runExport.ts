import { save } from "@tauri-apps/plugin-dialog";
import { Channel } from "@tauri-apps/api/core";
import type { ExportFormat, ExportProgress } from "$lib/api/types";
import type { ApiError } from "$lib/api/client";
import { toast, toasts } from "$lib/stores/toasts.svelte";

// Shared export flow: pick a save path (format = chosen extension), stream via a
// Channel, and toast the outcome. The caller supplies the actual export call so
// this works for both a query and a whole table.
export async function runExport(
  defaultName: string,
  doExport: (format: ExportFormat, path: string, channel: Channel<ExportProgress>) => Promise<number>,
): Promise<void> {
  const path = await save({
    defaultPath: defaultName,
    filters: [
      { name: "CSV", extensions: ["csv"] },
      { name: "JSON", extensions: ["json"] },
    ],
  });
  if (!path) return;

  const format: ExportFormat = path.toLowerCase().endsWith(".json") ? "json" : "csv";
  const channel = new Channel<ExportProgress>();
  const progressId = toast.info("Exporting…", { sticky: true });
  try {
    const rows = await doExport(format, path, channel);
    toasts.dismiss(progressId);
    toast.success(`Exported ${rows} rows`);
  } catch (e) {
    toasts.dismiss(progressId);
    toast.error(`Export failed: ${(e as ApiError).message}`);
  }
}
