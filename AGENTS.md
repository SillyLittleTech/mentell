# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Mentell is a local-first stationery-themed mental health / journaling PWA. It is a pure frontend React + TypeScript + Vite application with zero backend dependencies. All data persists client-side via IndexedDB (Dexie.js) and localStorage.

### Development commands

All commands are defined in `package.json` scripts:

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite on port 5173) |
| Lint | `npm run lint` (ESLint) |
| Type check | `npx tsc -b` |
| Build | `npm run build` (tsc + vite build) |
| Preview prod build | `npm run preview` |

### Non-obvious notes

- There are no automated tests (no test framework configured). Verify changes via lint, type checking, and manual browser testing.
- The app uses Vite 8 with `vite-plugin-pwa`; the service worker is generated at build time only (not during dev). PWA features cannot be tested with `npm run dev`.
- Use `npm run dev -- --host 0.0.0.0` to expose the dev server on all interfaces (needed in cloud/container environments).
- Debug mode: `npm run dev:debug` or `npm run build:debug` enables a debug panel via Vite's `--mode debug`.
