import { save } from "@tauri-apps/plugin-dialog";
import type { ExportFormat } from "$lib/api/types";
import { toast, toasts } from "$lib/stores/toasts.svelte";

// Shared export flow: pick a save path (format = chosen extension), run the
// export, and toast the outcome. The caller supplies the actual export call so
// this works for both a query and a whole table.
export async function runExport(
  defaultName: string,
  doExport: (format: ExportFormat, path: string) => Promise<number>,
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
  const progressId = toast.info("Exporting…", { sticky: true });
  try {
    const rows = await doExport(format, path);
    toasts.dismiss(progressId);
    toast.success(`Exported ${rows} rows`);
  } catch (e) {
    toasts.dismiss(progressId);
    toast.fromError(e, "Export failed");
  }
}
