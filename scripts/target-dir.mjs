// Resolves Cargo's target directory for the src-tauri crate. Never hardcode
// `src-tauri/target`: CARGO_TARGET_DIR and `[build] target-dir` in any
// .cargo/config.toml relocate it, and only `cargo metadata` sees every layer of
// that precedence. Falls back to the default when cargo is unavailable.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const fallback = path.join(root, 'src-tauri/target');

export function targetDir() {
  const { status, stdout } = spawnSync(
    'cargo',
    ['metadata', '--no-deps', '--format-version', '1',
     '--manifest-path', path.join(root, 'src-tauri/Cargo.toml')],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (status !== 0 || !stdout) return fallback;
  try {
    return JSON.parse(stdout).target_directory || fallback;
  } catch {
    return fallback;
  }
}

export const releaseDir = () => path.join(targetDir(), 'release');
