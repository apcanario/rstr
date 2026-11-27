# Review: bundle 6 (R17 Text layers, R12 Retouch), viewer check

Viewer: a fresh Opus 5.5 agent that had not seen the build. Final build `6879380` (clean tree). Read `CLAUDE.md`, `docs/RUN.md`, `docs/SPEC.md` 5, 8.6, 8.9, 9.2, 9.3, 10.1 (and 10.2, 10.3 for the Text tab), rows R17 and R12 in `docs/BACKLOG.md` (R17 from `git show 2c27823^:docs/BACKLOG.md`), their `docs/CHANGELOG.md` entries, `docs/reviews/R17.md` and `docs/reviews/R12.md`, `README.md`. No source file changed. Scratch probes ran from `/tmp/probe` against the built app (read-only).

## Scripts (this run)

- `npm run check`: exit 0. 22 files, 358 passed, 1 skipped; vitest 2062 s; type-check and build clean.
- `npm run smoke`: exit 0, `smoke: passed, 3 online checks SKIPPED (not verified)` (Google Fonts blocked, Carried R3); engine checks 2798 s. Layers with real fonts, 200 lists per style and format: 0 failing, 0 neither drawn nor flagged, 0 fallbacks from the layers (fallbacks 0 to 2 per format, none caused by layers). Flagged: Swiss 40 to 66 of 900 (4.4 to 7.3%), Postmodern 42 to 63 (4.7 to 7.0%), Brutalist 77 to 95 (8.6 to 10.6%), Vaporwave 53 to 84 (5.9 to 9.3%). Copier pass, no photo: 0 cells under their ratio before the pass, every format, with and without layers. Photo copier: `210 items, 4077 cells, 0 taken under by it, 2 under before it` (see S1). Stub-host `sw-hanken` check passed. Photo Layout-lock line passed. Text tab at 8 layers: 46 pages, no scroll, 48 px, no wrap, 46 flagged rows marked "!".
- `npm run sheet`: exit 0, 282 files, 4 `pairings NOT LOADED` lines (Carried R3). Its output matched the main chat's 14:29 run byte for byte except three screens (`screen-360x640-sheet-export-failed.png`, `-fullest.png`, `-text-2.png`; the strip counter reads 7 OF 9 here, 9 OF 9 in the smoke).

## R17 Done-when, line by line

| Line | True now? | Would a test fail if false? |
|---|---|---|
| Every v1 design in Kept opens and draws the same layout after migration (tested on the Scene) | Yes | Yes. `tests/layers.test.ts:47` restores 500 v1 specs through `restore` and `:61` migrates 172 more; each Scene hash is compared with `tests/fixtures/v1-kept.json`. 650 of 672 entries still hold the Scene recorded at `e510dbc` (before R17); 22 were re-recorded on purpose at R12 (16 boxed-word moves, 6 photo placements) and are marked `since`, so for those the test now guards R12's Scene, not the pre-R17 one. The reason is in the test header and the R12 changelog. |
| 9.2 passes for 1 to 8 layers in every mix of levels, per style (tested over 200 seeds) | Yes | Yes. `tests/layers.test.ts:105` runs 200 lists per style (stub measure) and fails on any 9.2 failure; `:94` asserts every count x format x mode in each block of 64 (the R17 E2 hole is closed); smoke runs 200 per style and format with real fonts, 0 failing. |
| A layer that cannot fit is flagged, never dropped (tested) | Yes | Yes. `tests/layers.test.ts:125` (eight long headlines, 1:1, every style: something flagged, every layer drawn xor flagged) and `drawnOrFlagged` in `runLayers` (`src/engine/proof.ts:500`); `tools/appcheck.py:428-443` asserts the rows are marked with "!" on a list that always flags. |
| The Text tab fits without scrolling at 8 layers (page chips) (tested) | Yes | Yes. `tools/appcheck.py:391` `run_layers` fails on fewer than two pages and runs `LAYOUT_JS` on every page, Simple and Advanced, every style, both sizes. `screen-*-text8-*.png` show 8 layers on paged rows with no scroll. |

## R12: the Carried items it cleared, and what it left

| Item | Cleared? | Evidence |
|---|---|---|
| R12 (from R17) layer fallbacks | Yes | Smoke: 0 fallbacks from the layers in all 16 style x format runs (real fonts); `tests/layers.test.ts:113` fails on any. |
| R12 (from R17) photo Layout-lock flake | Yes, on this run | Smoke line `photo 412x915: ... Layout lock holds it` passed; one run only, so the flake's absence is not proven beyond R12's own 0 of 100 probe. |
| R12 (from bundle 3) boxed-word halo | Without a photo only | S1. |
| R10 (from R10) photocopy tape and contours after a colour edit (and review R12 S1: label plate, caption fades) | Yes | `src/engine/recolour.ts:39-51`, `GraphicItem/RectItem/TextItem.mixed`, `src/engine/parts/type/pomo-copy.ts:128,152`; test in `tests/advanced.test.ts`. Spec line is incomplete (M5). |
| R10 (from R10) sw-hanken offline check | Yes, on this run | `fonts (stub font host): network off, unused sw-hanken picked: drawn with the default` passed. |

Carried left or added:
- R12 (from R12), error (type seed moves the photo): accurately stated. The test that carries it does not bound it (M2). The "2 of 416" count is printed by `console.log` in `tests/proof.test.ts:97`, which this run's log does not show, so I could not confirm the number.
- R12 (from R17) item 1 (flagged share): the real-font range 4.4 to 10.6% is exactly what this smoke printed; "up to five layers on 8-layer sheets" is wrong (S4).
- R12 (from R17) item 2 (Swiss cell 9, the Advanced edit row): cell 9 is still as described (`layers-swiss.jpg`, 1:1 light, seeds 360/460/560/6); "at 360 px" is wrong (M1).
- R12 (from R17) item 3 (poster "RSTR", wordmark tracking): the tracking half is stale (S3).
- R20 and the re-targeting: row R20 exists in bundle 9 with both items and Done-when lines; the two Carried entries say "re-targeted to R20". Their ids still name R10 and R12 (see S2).

## Errors

None.

## Should-fix

**S1. Carried R12 (from bundle 3), the boxed-word halo, is cleared only without a photo; with a photo a boxed word's cell reads 2.34:1 against 3:1 and smoke does not fail.**
- Where: `tools/smoke.py:479` (the photo copier run adds `r['before']` to a count and prints it; it fails only on `low`), and `src/engine/parts/type/pomo-copy.ts:310-312` (the push clears the boxed word of earlier words' halos only; "later words cover it as usual").
- Seen: smoke prints `photo copier: ... 2 under before it` (R15 recorded 0 here). Probe: both are `title.word1` cell 5, ratio 2.34, need 3, the boxed word "and", in `{"v":2,"style":"pomo","format":"9:16","mode":"light","finish":"clean","marks":"off","seeds":{"layout":6137,"colour":6201,"graphic":6301,"type":6401},"pick":{"palette":null,"colours":null,"pairing":null,"motif":null,"layout":null,"dialect":"photocopy"},"photo":{"id":"test-landscape","treatment":"mono","place":{"role":"box"}},"params":{},"text":<default four layers>}` (and the same with `"treatment":"posterise"`), frame `copy-low`. The same spec without the photo reads 0. Drawn, the later word "noise" and its paper halo meet the box by the foot of the "d".
- Spec 5: any text against what is directly behind it reaches 3:1 at this size. R12 cleared this item because "smoke fails on boxed cells"; it does not in this run.
- Fix: make the photo copier run fail on any `before` cell, as the no-photo runs do since review R12 M5 (print the spec); then either keep later words' halos off the boxed word's letters too, or count the later word as cover in the cell reader if that is what is happening; add this spec to `tests/pomo.test.ts`. Until then reopen the Carried item for the photo case.

**S2. The backlog keeps a closed row in the queue, and every R12 Carried item now targets a closed row.**
- Where: `docs/BACKLOG.md:63-69` still has `## Bundle 6: text layers, retouch` with `### R12. Retouch` ("Needs Pedro's notes to run. Works every note and everything in Carried."), while `:108` lists R12 as Done. `CLAUDE.md`: "done rows leave the queue"; RUN.md 4.2: a Carried item names "the row that should fix it". Carried R12 (from R5), (from R6), (from R8), (from R9), (from bundle 4), (from bundle 5), (from R17) x3 and (from R12) all name R12, which is closed; several say "fix with his Notes", for which no open row exists. R12 (from R8) item 1 and R10 (from R10) tracking say "re-targeted to R20" under ids that still name R12 and R10.
- Fix: delete the bundle 6 section (lines 63-69). Either add a standing row for retouch from Pedro's notes (a new id, in a numbered bundle, "Works every note and everything in Carried", as R12 was) and re-target the taste-call items to it, or state in each item which row takes it; rename the two R20 items so their id names R20. Record the move in the changelog.

**S3. Carried R12 (from R17) item 3 asks Pedro about a wordmark tracking that was already fixed.**
- Where: `docs/BACKLOG.md:43` "its 0.22 em letter-spacing reads loose in lower case (minor)". `src/app/app.css:12` has `letter-spacing: 0.06em` since `52eeabc` (R17 review M1, applied by the fixer); the R17 changelog's Carried line repeats the stale claim. The screens show `rstr` set tight at both sizes.
- Fix: drop the tracking sentence from the item (keep the poster "RSTR" question), and say in this bundle's changelog entry that the R17 entry's "and the wordmark's tracking" was already fixed at `52eeabc`.

**S4. Carried R12 (from R17) item 1 understates the Brutalist flags.**
- Where: `docs/BACKLOG.md:41` "Brutalist and Vaporwave flag up to five layers on 8-layer sheets". `layers-brutal.jpg` cell 4 (A dark, 8 layers, `layerMix(7)`, seeds 307/407/507/6, frame title-up) flags six: t3, t4, t5, t6, t7, t8. Only two of eight headlines are drawn.
- Fix: say six (and name that cell) so Pedro judges the real worst case.

## Minor

**M1. Carried R12 (from R17) item 2 says the level button is left out "at 360 px".** `src/app/App.tsx:484` (`{!advanced && lvl}`) leaves it out of the Advanced edit row at every width, and spec 8.6 describes that as built; the level stays on the row's normal state. Fix: "in Advanced a row's edit controls (More) show no level button, at any width; the level is changed on the row itself".

**M2. The 9.3 photo test does not bound the type-seed move it carries.** `tests/proof.test.ts:91-97` filters out every `type moved a graphic` failure and only logs the count. If the type seed moved the photo in every design, or moved a non-photo graphic in a design with a photo, the test would pass. Fix: assert the type-seed count per style is at most a stated ceiling (for example 2 of the run's count) and that every such failure names the photo; print the count to the test name or an `expect` message so the check log carries it.

**M3. Smoke sets no ceiling on flagged layers with real fonts.** `tools/smoke.py:70-78` prints `flagged` only; the stub ceiling in `tests/layers.test.ts:76` is 10% for Brutalist, and this run's real-font Brutalist 1:1 is 95 of 900, 10.6%. A real-font regression in the flagged share would pass smoke. Fix: fail above a per-style real-font ceiling (measured plus a margin, for example 12%).

**M4. README.** (a) `README.md:20` describes R12's re-mix of photocopy tape, contours, info label and faded caption copies under "Where it is going"; it belongs in "What it does today" beside the per-design colour edit (`:7`). (b) The Status table (`:26-34`) has no rows for bundle 8 (R19, finishes retouched) and bundle 9 (R20, carried engineering), which the backlog lists. (c) `:33` says "bundle viewer check pending": change to done (with the date) once this review is applied. "What it does today" otherwise matches the build (text layers, levels, More, Advanced Head/Foot places in Swiss and Postmodern, migration, flags, the held photo role).

**M5. Spec 5 names only part of what R12 re-mixes.** `docs/SPEC.md:96` "Colours a style mixes from two roles (a faint pattern, photocopy contours and tape) are mixed again". R12 S1 also re-mixes the photocopy info label's plate and the caption's two faded copies (`src/engine/recolour.ts:9-10`). Fix: add them to the list.

**M6. The R17 changelog entry describes the Text tab row before the fixer moved on/off.** `docs/CHANGELOG.md:8` "level stepper, field, on/off, More". After review R17 M2 the switch is inside More (`src/app/App.tsx:487`, spec 8.6). Do not rewrite the entry; note the correction in this bundle's entry.

**M7. Flagged level buttons shrink to about 9 CSS px.** `screen-360x640-text8-simple.png` and `-advanced.png`: "BODY !" and "LABEL !" in the 48 px level button are set far smaller than unflagged "HEAD" or "SUB" (`src/app/App.tsx:480`, `LEVEL_SHORT[...] + ' !'`). Legal (shrinks to fit, no wrap) but hard to read on a phone. Fix: mark the flag without text (the row's fill or a dot), keep the level word at the row's size.

**M8. Legal but clumsy layer designs, for Pedro with the sheets.** Seeds are `layerMix(i)`, `{layout: 300+i, colour: 400+i, graphic: 500+i, type: 6}`, as `tools/sheet.py:118` builds them.
- Extra headlines stacked flush under the lead read as one title: `layers-swiss.jpg` cell 3 (i=5, 3:4 dark: "Signal and noise / Signal / Signal"), `layers-vapor.jpg` cell 7 (i=54, 9:16 light: "Signal / Signal / and noise"). Spec 8.6 sets them alike and kept apart; at the same size and no gap they merge.
- A Brutalist second headline of eight words on one full-width line reads as a caption: `layers-brutal.jpg` cell 2 (i=3, A dark, top line) and cell 3 (i=5, 3:4 dark, foot line).
- A Postmodern photocopy second headline loses whole letters at the page edge: `layers-pomo.jpg` cell 3 (i=5, 3:4 dark) reads "IGHT PLAIN / WORDS MAK". It is the photocopy run-off rule (one side, at most 0.3 em, `pomo-copy.ts:39`) applied to extras; the same cut shows on the 8-word photocopy cells of `text-pomo.jpg` (older than this bundle).
- `layers-swiss.jpg` cell 5 (i=50, 9:16 light, no headline): one small subhead at the top over a dot field, its last word "hand" alone on the second line.
- Carried R12 (from R17) item 2's cell 9 (i=60) is unchanged.

## Looked at

Every sheet in `shots/` (sheets, text, layers, variety, palettes, pairings, finishes, marks, photo, format A, export, refs and `refs-compare.jpg`) and the screens (Simple and Advanced, every tab and page, both sizes, Text tab with the default four layers and at eight with a row's More open, Kept, Export). Wordmark: lower case `rstr` with the dimmed `t` in every screen, tab title `rstr` (`index.html:7`); poster "RSTR" left as Carried. No control under 48 px, no wrapped or cut control text seen; text fields cut their words at the field edge as inputs do. Styles against refs: as at bundle 5 (Swiss blocks without its red block, Carried R1 note); no new drift seen. `Math.random()`: only `src/engine/spec.ts:75`. Not yet done for the bundle close (main chat's job, not findings): `docs/PROCESS.md` has no bundle 6 entry and `docs/plan.html` still shows Session 6 as Next. Whether any design looks good is Pedro's call; the scripts prove only that they are legal.

## Verdict

**Fix.** 0 errors, 4 should-fix, 8 minor. All four R17 Done-when lines are true, each with a test that would fail. R12's cleared items hold except the boxed-word halo with a photo (S1); the Carried list needs its targets and three statements corrected (S2 to S4).
