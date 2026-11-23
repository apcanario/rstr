# Backlog

The next open bundle is the first numbered bundle below with a row not in Done. `docs/RUN.md` says how a chat works it. One chat works one whole bundle; a chat that stops early is resumed with the same starter and picks up at the first row not Done.

| Bundle | Rows | What you get |
|---|---|---|
| 1 | R1, R2, R3, R4 | The real engine, palettes with light and dark, font pairings, the app frame and Simple mode, live on Pages |
| 2 | R5, R6, R7 | Swiss and Postmodern finished, the three finishes |
| 3 | R8, R9, R10 | Brutalist, Vaporwave, Advanced mode |
| 4 | R11, R12 | My palettes, own fonts, spec in and out; retouch from notes |
| later | M, K | Motion, then photos, assets and kits. Each needs a Fable chat first (spec 11) |

## Carried

Nothing yet.

## By hand (Pedro)

- **H1. Turn Pages on** after bundle 1's first push: repo Settings, Pages, Source: GitHub Actions. Then the app is at https://apcanario.github.io/rstr/.
- **H2. Look and use.** After each bundle, shuffle each style on the phone for a few minutes and send what is off in the next starter's `Notes:` line. Open until Pedro says done.

## Bundle 1: engine, colour, type, frame

Read spec 3, 4, 5, 6, 9 and 10 in full before any row of this bundle.

### R1. The engine

- Scaffold: TypeScript, Vite, Preact, Vitest, the Pages workflow (copy the shape of `apcanario/groovebox`), `npm run check`, `smoke`, `sheet`, `dev`; `tools/smoke.py` and `tools/sheet.py` in Python with Playwright.
- Port `docs/archive/spike/engine.js` into `src/engine/` as layout -> Scene -> paint (spec 4), all four styles as they stand in the spike, graphics as separate modules taking `t`.
- Spec schema v1 with validation and migration; four seeds (the spike has three: add type, and rename motif to graphic).
- The layout solver with candidates and a fallback layout per style.
- Ink-bounds spacing.
- The invariants of spec 9.2 and 9.3 in the smoke run, printing the failing spec.
- A plain one-screen app (the spike's `app.html` is enough of a guide) so Pages shows something: stage, format, Shuffle.
- Fonts bundled as woff2 with `public/LICENSES.txt`.

**Done when:** the reference specs in `docs/archive/spike/shots.py` draw designs a reviewer judges the same as `docs/design/refs/` for all four styles; 9.2 and 9.3 pass for all four styles (tested); no `Math.random()` outside seed creation (tested); `check` and `smoke` pass.

### R2. Colour, light and dark

- Palettes as role data per style (spec 5), the spike's palettes moved over, each with a hand-written light and dark form, 8 per style.
- `mode` in the spec; every style reads roles only, never a literal colour.
- The contrast rule, with plates where a style needs them.
- Vaporwave light mode as spec 8.4 says.

**Done when:** every palette of every style passes 9.2 in both modes (tested); no colour literal outside `src/data/palettes/` and the app's own stylesheet (tested); sheets show each style in light and dark. Whether the dark forms look right is Pedro's call.

### R3. Type

- Pairings as data (spec 6), the type seed and `pick.pairing`, per-style allowed lists, at least 4 pairings per style, 16 to 20 families bundled in total, every licence recorded.
- Each family's weights limited to what the styles use, to keep the download small; say the total font weight in the changelog.

**Done when:** every pairing of every style passes 9.2 (tested); changing only the type seed moves no graphic (tested); a sheet per style shows every pairing with the same other seeds.

### R4. The frame and Simple mode

- The frame of spec 10.1 and Simple mode of 10.2: header, stage, format, locks, panel, action row with Back, Shuffle, Keep and Export, tab bar; Kept sheet; export sheet with Save and Share.
- Style tiles as small live renders.
- The app-wide Simple/Advanced switch is present and remembered; Advanced shows Simple's tabs until R10.
- Autosave of the current design, Back steps and Kept.
- Screen shots of every tab and sheet at 360 x 640 and 412 x 915 in `npm run sheet`.

**Done when:** nothing scrolls at 360 x 640 or 412 x 915 (tested); every control is at least 48 px (tested); no text on a control wraps or overflows with the longest palette, pairing and style names (tested); a locked facet survives 50 shuffles (tested); Back restores the previous design exactly (tested); export gives files of the right pixels for all three sizes (tested); reload brings back the design, Back steps and Kept (tested).

## Bundle 2: Swiss, Postmodern, finishes

Read spec 7 and 8.1, 8.2, 8.5.

### R5. Swiss, finished

- The five layouts, the six new graphics, two or three positions per text slot (spec 8.1, 8.5).
- A tuning pass: generate 200 designs, list the clumsy ones with their specs, tighten the rules until the list is short. Record what was tightened.

**Done when:** every layout and graphic passes 9.2 (tested); each layout and graphic appears on the sheets; the approved look in `docs/design/refs/swiss-*.jpg` is still reachable (the reference specs still draw recognisably the same designs). Whether it is good is Pedro's call.

### R6. Postmodern, finished

- The six new shapes, two more ground patterns, a second title treatment (letters on separate tiles), positions per slot (spec 8.2).
- The same tuning pass as R5.

**Done when:** as R5, against `docs/design/refs/pomo-*.jpg`; no shape is ever drawn over text (tested).

### R7. Finishes

- Clean, Grain, Grunge as spec 7, deterministic, with the title stamped again; the Look tab's Finish control.
- Export time measured in headless Chrome for the largest format with Grunge, recorded in the changelog.

**Done when:** the same spec gives identical pixels with each finish (tested); Grunge never takes a text item under 3:1 (tested); a sheet shows every style under every finish.

## Bundle 3: Brutalist, Vaporwave, Advanced

Read spec 8.3, 8.4 and 10.3.

### R8. Brutalist, finished

- Everything in spec 8.3 including the R8 additions, at least 4 heavy pairings, the tuning pass.
- Long titles: 8 words must still be heavy and legible.

**Done when:** as R5, against `docs/design/refs/brutal-*.jpg`; every title line of four words or fewer spans the full inner width within 1% (tested).

### R9. Vaporwave, finished

- Everything in spec 8.4 including the R9 additions, the tuning pass, title legibility over the busiest part of the sky and floor.

**Done when:** as R5, against `docs/design/refs/vapor-*.jpg`.

### R10. Advanced mode

- Spec 10.3: six tabs, controls generated from each style's parameter list, page chips, picks and params written to the spec, cleared by Shuffle unless locked.

**Done when:** every parameter of every style can be set and changes the design (tested); setting any parameter to either end of its range still passes 9.2 or the control's range is narrowed until it does (tested); nothing scrolls and nothing wraps in Advanced at both screen sizes (tested).

## Bundle 4: yours, then retouch

### R11. My palettes, own fonts, spec in and out

- Edit and save palettes (spec 5). Load own font files (spec 6). Copy and paste a spec (spec 10.3).

**Done when:** a saved palette and a loaded font survive reload and can be picked by Shuffle (tested); a pasted spec from another phone draws the same layout (tested on the Scene); a broken pasted spec shows an error and changes nothing (tested).

### R12. Retouch

Needs Pedro's notes to run. Works every note and everything in Carried.

## Done

Nothing yet.
