#!/usr/bin/env node
// Build Basalt DB Studio and install it locally, or produce a distributable installer.
//   node scripts/install.mjs             build, install to the OS app location, launch
//   node scripts/install.mjs --rollback  restore the previous build from the archive
//   node scripts/install.mjs --dist      build the DMG / NSIS installer into ~/Downloads
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { releaseDir } from './target-dir.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const { productName } = read('src-tauri/tauri.conf.json');
const { version } = read('package.json');

const win = process.platform === 'win32';
if (!win && process.platform !== 'darwin') {
  console.error('macOS or Windows only — on Linux use `pnpm tauri build` and your distro package.');
  process.exit(1);
}

const archive = path.join(os.homedir(), '.basalt-builds');
const installed = win
  ? path.join(process.env.LOCALAPPDATA, 'Programs', productName, `${productName}.exe`)
  : path.join('/Applications', `${productName}.app`);

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts });
const build = (...flags) => {
  const { status } = run('pnpm', ['tauri', 'build', ...flags, ...process.argv.slice(2).filter((a) => !a.startsWith('--roll') && a !== '--dist')]);
  if (status !== 0) process.exit(status ?? 1);
};
const newest = (dir, match = () => true) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(match).map((n) => path.join(dir, n))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
    : undefined;

if (process.argv.includes('--dist')) {
  // The Tauri bundler mounts and opens the DMG itself — don't `open` it again here.
  build('--bundles', win ? 'nsis' : 'dmg');
  const dir = path.join(releaseDir(), 'bundle', win ? 'nsis' : 'dmg');
  const built = newest(dir, (n) => n.endsWith(win ? '.exe' : '.dmg'));
  if (!built) throw new Error(`no installer produced in ${dir}`);
  const dest = path.join(os.homedir(), 'Downloads', path.basename(built));
  fs.copyFileSync(built, dest);
  console.log(`\n→ ${dest}`);
  process.exit(0);
}

const rollback = process.argv.includes('--rollback');
fs.mkdirSync(archive, { recursive: true });

let src;
if (rollback) {
  src = newest(archive);
  if (!src) {
    console.error(`no archived builds in ${archive}`);
    process.exit(1);
  }
  console.log(`rolling back to ${path.basename(src)}`);
} else {
  build(...(win ? ['--no-bundle'] : ['--bundles', 'app']));
  // --no-bundle leaves the raw cargo binary, which is named after Cargo.toml, not productName.
  src = win
    ? path.join(releaseDir(), 'basalt-db-studio.exe')
    : path.join(releaseDir(), 'bundle/macos', `${productName}.app`);
}

if (win) run('taskkill', ['/IM', `"${productName}.exe"`, '/F'], { stdio: 'ignore' });
else run('osascript', ['-e', `'quit app "${productName}"'`], { stdio: 'ignore' });

if (fs.existsSync(installed)) {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const to = path.join(archive, `${productName} ${version} ${stamp}${path.extname(installed)}`);
  fs.cpSync(installed, to, { recursive: true });
  fs.rmSync(installed, { recursive: true, force: true });
}

fs.mkdirSync(path.dirname(installed), { recursive: true });
fs.cpSync(src, installed, { recursive: true });
if (rollback) fs.rmSync(src, { recursive: true, force: true });

// ponytail: keep the 5 most recent archived builds; bump the slice if you need deeper history
for (const stale of fs.readdirSync(archive).map((n) => path.join(archive, n))
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(5)) {
  fs.rmSync(stale, { recursive: true, force: true });
}

if (win) spawnSync('cmd', ['/c', 'start', '""', `"${installed}"`], { stdio: 'ignore' });
else run('open', ['-a', `"${installed}"`]);
console.log(`\n→ ${installed}`);
