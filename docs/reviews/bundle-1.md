# Viewer check, bundle 1 (R1 to R4)

Base c2435a7, HEAD 9f9b40f. Viewer: Opus 5.5 agent. No source file changed.

## Scripts

- `npm ci`: clean, 0 vulnerabilities.
- `npm run check`: exit 0. tsc clean, 91 tests pass, build 102.7 kB JS.
- `npm run smoke`: exit 0, last line `smoke: passed, 3 online checks SKIPPED (not verified)`. 9.2 has 0 failing and 0 unexpected fallbacks across every style, format and mode, unpicked, picked and per palette. The 72 over-long designs fall back and pass. Knock-outs, 9.3 streams, 9.3 pixels and 9.2.6 exports pass. The app checks pass at 360 x 640 (63 screens) and 412 x 915 (45 screens). Google Fonts is blocked here (`TypeError: Failed to fetch`), so the three online checks SKIP. Offline, the 9.3 type-seed line moved text only for Brutalist (typeMoved 0 for Swiss, Postmodern and Vaporwave), because only core pairings are loaded. The stub-measure unit test covers that line.
- `npm run sheet`: exit 0. It prints `pairings NOT LOADED` for 37 of 42 pairings (Swiss 15/16, Postmodern 7/8, Brutalist 8/10, Vaporwave 7/8).
- Pages: `gh run list` shows the Pages workflow succeeded on all four close commits (R1 to R4). The live URL was not opened.

## Done-when, line by line

### R1. The engine: 3 of 4 true

| Line | Now | Would a test fail if false? |
|---|---|---|
| The reference specs draw designs a reviewer judges the same as `docs/design/refs/` for all four styles | **Not true for Vaporwave 3:4 and 9:16.** In `shots/refs-compare.jpg` the refs put the title in the sky over the sun. Now it sits on the floor, and the 9:16 info window moves from the floor to the top left. Swiss topo, bars, dots and no-text, the three Brutalist refs and Vaporwave 1:1 read as the same designs. Two more are changed, both recorded as R1 choices: `swiss-blocks-9x16` lost its red block and has a different block shape, and both Postmodern refs place different shapes. See S1. | Judged by eye, no test. |
| 9.2 and 9.3 pass for all four styles (tested) | True. | Yes. `tests/engine.test.ts` proves the checker catches each of rules 1 to 5. The unit tests and smoke run 9.2 and 9.3 over every style, format and mode, and fail on any failure or unexpected fallback. |
| No `Math.random()` outside seed creation (tested) | True. The only call is `src/engine/spec.ts:37` in `newSeed`. | Yes for `src/**/*.ts(x)` (`tests/random.test.ts`). The test does not scan `public/sw.js` or `index.html` (M6). |
| `check` and `smoke` pass | True. | They are the scripts. |

### R2. Colour, light and dark: 3 of 3 true

| Line | Now | Would a test fail? |
|---|---|---|
| Every palette of every style passes 9.2 in both modes (tested) | True. | Yes. Each palette is picked in light and dark, in the unit tests (`tests/proof.test.ts`) and in smoke. `tests/palettes.test.ts` also checks each style's needs per form. |
| No colour literal outside `src/data/palettes/` and the app stylesheet (tested) | True. | Yes. `tests/literals.test.ts` checks hex, colour functions and all 148 names in `src/` and `index.html`, and has self-tests for the finder. |
| Sheets show each style in light and dark | True: `shots/sheet-*-{light,dark}.jpg` and `shots/palettes-*.jpg`. | Not a tested line. |

### R3. Type: 4 of 6 true, 2 unverified

| Line | Now | Would a test fail? |
|---|---|---|
| Every pairing of every style passes 9.2 with its real fonts loaded (tested, online) | **Unverified.** Smoke SKIPs it because Google Fonts is blocked. The stub-measure unit test passes for all 42 pairings. | `fontcheck.online_pairings` would fail it when online. |
| With the network off after one use, a used pairing still draws with its own fonts (tested) | True through the stub font host (service-worker cache, no network hit). It is unverified against Google itself (SKIP). | Yes: `fontcheck.offline_after_use`. |
| With the network off and an unused pairing picked, the design draws with the default pairing and the note shows (tested) | True. | Yes: the stub run, `wait_four_seconds` (4.2 s) and the unit test. |
| Layout never runs with a fallback system font (tested: the Scene records the families it measured with) | True. | Yes. The check is by face: `never_fallback` covers 414 Scenes, and the unit tests in `tests/proof.test.ts` include the face-level case. |
| Changing only the type seed moves no graphic (tested) | True on the stub measure, where typeMoved is above 10 per style. With real fonts, smoke reaches Brutalist only while offline. | Yes for the stub. The real-font run waits on Carried R3. |
| A sheet per style shows every pairing with the same other seeds | **Unverified.** 37 of 42 cells are drawn as the default and labelled NOT LOADED. The sheet is right in shape. | Not a tested line. Carried R3 (3) and H3. |

The row's first bullet ("check every family resolves from Google Fonts") is also open. `fetch_fonts.py --check` cannot reach Google from here. It is carried as R3 (2).

### R4. The frame and Simple mode: 7 of 7 true

| Line | Now | Would a test fail? |
|---|---|---|
| Nothing scrolls at 360 x 640 or 412 x 915 (tested) | True. | Yes. `tools/appcheck.py` LAYOUT_JS covers every tab, page and sheet, each style in both modes. |
| Every control at least 48 px (tested) | True, and the shots agree. | Yes: buttons, inputs and textareas are measured. |
| No text on a control wraps or overflows with the longest palette, pairing and style names (tested) | True. | Yes. Each style's widest palette and pairing names are picked, and every `[data-fit]` label is checked for wrapping, overflow, leaving its control and being shortened to almost nothing. The Type lock shows only the display family, as recorded (Carried R10). |
| A locked facet survives 50 shuffles (tested) | True. | Yes: in the unit test and through taps at both sizes. Both check the seed, the pick and what is drawn. |
| Back restores the previous design exactly (tested) | True. | Yes. 12 steps are compared on the spec and on the stage pixels. |
| Export gives files of the right pixels for all three sizes (tested) | True. | Yes: JPEG and PNG downloads are opened and their sizes compared. |
| Reload brings back the design, Back steps and Kept (tested) | True. | Yes: the restored state is compared with the saved state, and Back still works after reload. |

## What the scripts cannot judge

I looked at every file in `shots/`: 8 style sheets, 4 palette sheets, 4 pairing sheets, 4 text sheets, `refs-compare.jpg`, 15 `ref-*.jpg` and 22 screen shots. No control looks under 48 px, and no control label is cut or wraps. Text fields show the start of longer values, which is normal for an input. The chrome is greyscale against the coral of `ui-*.jpg`, as R4 recorded and reviewed. Below are the legal but clumsy designs and the drift from the refs.

## Findings

### Errors

None.

### Should-fix

**S1. R1's refs line is closed as Done but is not met for Vaporwave.** `docs/BACKLOG.md` Done, R1 entry. In `shots/refs-compare.jpg`, `vapor-3x4` and `vapor-9x16` move the title from the sky to the floor, and the 9:16 info window moves to the top left. This follows from the R1 choice that rejects sky titles while any palette cannot carry them. Carried R9 holds the fix (a sky-title treatment for every palette), but the Done entry says only "Review R1 applied". Fix: R1's Done entry should say "refs line open for Vaporwave 3:4 and 9:16 (sky title), see Carried R9". The R9 Carried line should name the two refs it must bring back. Pedro should also look at `swiss-blocks-9x16`, which has lost its red block (an R1 choice he can veto).

**S2. The Swiss disc is cut flat by its own box into a barrel or bowl.** `src/engine/graphics/swiss.ts:106-112`, ported unchanged from `docs/archive/spike/engine.js:181`. The radius runs up to 0.72 x the box's short side, and paint clips to the box. In all 16 cells of `shots/palettes-swiss.jpg`, the disc has a flat top under the rule and a flat bottom, and the small ink satellite is clipped away. The same happens in `shots/sheet-swiss-light.jpg`, last cell. Its spec is style swiss, format 9:16, mode light, pick all null, seeds `{layout: 88109, colour: 1154019, graphic: 14299799, type: 4341}`. It is legal, but it does not read as a Swiss disc: the box edge, not the canvas edge, is doing the cropping. Fix, for R5's tuning: keep the disc inside its box (rad no more than half the short side, with the centre clamped), or let it bleed only at a canvas edge. Add it to Carried under R5.

### Minor

**M1. Postmodern palettes sheet: everything is packed into the upper 60%.** In `shots/palettes-pomo.jpg`, all 16 cells (3:4, one seed set) put the shapes and type above the subtitle and leave the lower 40% as empty ground with confetti. Carry to R6's tuning pass.

**M2. Vaporwave info window over the sun.** In `shots/sheet-vapor-light.jpg` and `-dark.jpg`, second row, first cell, the window covers the top left of the sun. Its spec is vapor, 1:1, lagoon, c0, seeds `{layout: 48514, colour: 630374, graphic: 7801254, type: 4186}`. It is legal (window as plate) but crowded. Carry to R9.

**M3. Vaporwave 8-word title at 1:1.** In `shots/text-vapor.jpg`, fourth cell, the title on the floor gets a pale rectangular plate and leaves an orphan "TITLE" on its third line. It reads as a box pasted on the grid. Carry to R9 with Carried R9's title-legibility work.

**M4. H1 left the By-hand list with no record.** `docs/BACKLOG.md` By hand: H1 ("Turn Pages on") is gone, and no changelog line says it was done or that the deploy was checked (RUN 4.5). The Pages workflow succeeded on all four closes, so H1 is in effect done. Fix: add to the R4 changelog Checks "Pages deploy: workflow success on each close; live URL unverified" and a Done note "H1 done (Pages deploys)".

**M5. An empty "Bundle 1" section is left in the queue.** `docs/BACKLOG.md` keeps the heading "Bundle 1: engine, colour, type, frame" and its read-first line with no rows under it. Fix: remove it. The rows are in Done.

**M6. The `Math.random` test scans only `src/**/*.ts(x)`.** `tests/random.test.ts:6-10` does not cover `public/sw.js` or `index.html`. Nothing there uses it today. Fix: add `public/*.js` and `index.html` to the scan.

**M7. The Layout lock shows a seed fragment.** When nothing is picked, `src/app/App.tsx:332` shows `#` plus the first four hex digits of the layout seed. In the shots it reads "#0002". The other locks name what they hold (palette, motif, family). Fix: show the solved Scene's layout name (`scene.layout`, made human, with "Fallback" for the fallback) as the Graphic lock does with its motif.

## README, backlog, changelog

- `README.md` "What it does today" matches the app as built: Simple mode, the locks, Back, Kept, export, autosave, 8 palettes with light and dark, 42 pairings with the online lines unverified, Finish and Marks limited to Clean and Off, and Advanced showing Simple's tabs. Status "R1 to R4 done, viewer check next" is right until this check closes.
- Backlog and changelog agree. R1 to R4 are in Done, newest first, each with one changelog row, and no done row is left in the queue (apart from the empty heading, M5). Carried holds every unfixed review item I traced: R1 S2, S4, M4, M6 and the R5 note; R3 S1, S2, S5, M5, M6; R4 S1, M4, M6, M7. It does not yet hold S1, S2 or M1 to M3 from this report. The fixer should carry what it does not fix.
- The By-hand list is H3 and H2. H3 (online checks) is correct and still open, and H2 is open. H1 is missing without a record (M4).

## Verdict

Fix: 0 errors, 2 should-fix, 7 minor. Engine, colour and frame lines are true and tested. Two R3 lines remain unverified because Google Fonts is blocked here (Carried R3, H3). R1's refs line is not met for Vaporwave 3:4 and 9:16 until R9.
