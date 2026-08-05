# Codex repository instructions

Before doing project work, read `CLAUDE.md` completely and follow it as the
repository's process, architecture, quality, testing, performance, and workflow
contract.

Before reading, writing, or reviewing any frontend, Svelte, Tailwind, theme, or
UI/UX code, also read `DESIGN.md` completely. `DESIGN.md` is the source of truth
for UI design and frontend architecture and governs on any conflict.

Before starting milestone work, read
`docs/superpowers/specs/2026-07-21-basalt-db-studio-design.md` completely. That
document owns product architecture and scope; `CLAUDE.md` owns process, and
`DESIGN.md` owns UI decisions.

Use `pnpm` for all Node.js tooling. Never use `npm` or `npx`; run package
binaries with `pnpm exec` or `pnpm dlx`.

Never commit or push without explicit user approval.

When correcting documentation, edit it in place so it reads as if the corrected
version had always been there. Leave change history to version control.
