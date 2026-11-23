# RSTR

A phone poster generator for Pedro: pick a style, shuffle, type, export. A web app on GitHub Pages, later wrapped in an APK. One user, one phone. Rules and seeded randomness, not AI image generation.

## Read first
- `docs/SPEC.md` is what the app is. Decisions there are settled; do not reopen them.
- `docs/RUN.md` is how a chat works a row. Follow it.
- `docs/BACKLOG.md` is the queue. `docs/CHANGELOG.md` is the record.
- `docs/design/refs/` holds the looks Pedro approved or was shown. `docs/archive/spike/` is the 23 Nov 2026 spike those came from: a reference to port from, not code to ship.

## Stack
TypeScript, Vite, Preact, Canvas 2D. Vitest for unit tests, Python + Playwright for the tools. No other runtime dependency without a changelog line saying why.

## Commands
- `npm ci` installs.
- `npm run check` type-checks, runs the unit tests and builds. It must pass before any commit.
- `npm run smoke` builds, opens the app in headless Chrome, and runs the invariants of spec 9 over many seeds. It must pass before any push.
- `npm run sheet` builds and writes contact sheets to `shots/`. A person or a reviewer looks at them.
- `npm run dev` serves locally.

## Rules
- Work on `main`. A push to `main` deploys to GitHub Pages.
- Never push with `check` or `smoke` failing.
- Every push that changes the app also updates `docs/BACKLOG.md` and `docs/CHANGELOG.md` in the same commit. Backlog: done rows leave the queue, nothing is worked that is not a row, Carried holds every known fix. Changelog: one line per row, newest first, no essays.
- `README.md` says what the app is and does. A row that changes what the app does updates its "What it does today" and "Status" in the same commit.
- The scripts prove a design is legal (nothing overflows, overlaps or fails contrast). They cannot judge whether it looks good. Only Pedro's eyes do that, so never claim a design is good.
- All drawing sits in `src/engine/`. UI code never touches a canvas context except to hand one to the engine.
- Every random choice comes from the seeded generators, never `Math.random()` (the one exception: making a new seed).
- Styles, palettes, pairings and motifs are data plus small pure functions. Pickers list whatever exists.
- Phone first: portrait, one thumb, controls at least 48 px, no hover states, nothing scrolls.
- Free fonts only (Google Fonts). The web app fetches them on demand and caches them, with a small core set bundled; the APK bundles all of them. Licences of bundled fonts go in `public/LICENSES.txt`.
- No Shōmen branding anywhere. Its visual elements (`docs/design/elements.md`) are reused; its name, logo, colours and content are not.
- Tone: direct. No flattery, no filler.
