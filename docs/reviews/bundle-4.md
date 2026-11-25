# Viewer check, bundle 4 (R8, R9, R10)

HEAD 26bb28c. Viewer: Opus 5.5 agent that had not seen the builds. No source file changed. Read: `CLAUDE.md`, `docs/RUN.md` 4 and 4b, spec 5, 8.0, 8.3, 8.4, 9 and 10.3, the R8, R9 and R10 rows and their Done-when lines (`git show 470348c:docs/BACKLOG.md`, unchanged up to `26bb28c~1`), the Carried list at `26bb28c~1` and now, the R10 changelog entry, `README.md`. The backlog's Bundle 4 section has no bundle-level Done-when paragraph, only "Read spec 5, 8.0, 8.3, 8.4 and 10.3", so the rows' lines are the whole list. Looked at every sheet and the screens of the `npm run sheet` run below against `docs/design/refs/brutal-*.jpg` and `vapor-*.jpg`. Four scratch probes in `/tmp/viewer/probe/` (outside the repo) read Scenes and Advanced rows through `window.__rstr` on the built app.

## Scripts

All run once each on `26bb28c`, detached, the turn kept open; no rerun.

- `npm run check`: exit 0. tsc clean; 18 files, 245 passed, 1 skipped (the opt-in hash printer, `tests/snapshot.test.ts:38`), tests 1250 s; build 241.37 kB JS. Started 12:12, ended 12:34.
- `npm run smoke`: exit 0, `smoke: passed, 3 online checks SKIPPED (not verified)` (Carried R3, expected). 12:34 to 13:12, about 38 min. The flaky sw-hanken offline font check (Carried R10 from R10) passed first time; no rerun. 9.2 per palette form: 400 designs per style and format, 0 fallbacks, 0 failing; marks light and full 400 per style and format, 0 failing. Variety with real bundled fonts: Brutalist 0 repeats in 60, nothing missing in 300, top layout boxed 15% (1:1), table-first 13% (3:4), split 16% (9:16); Vaporwave 0 repeats, nothing missing, windows 16%, title-band 14%, title-band 17%. Advanced: every value of every control of 2 designs per seed set, style and format, plus 18 (Swiss) to 50 colour edits each, 0 fallbacks, 0 failing. Appcheck: 360 x 640, 65 Simple screens and 250 Advanced screens; 412 x 915, 47 and 150; no scroll, no wrap, controls at least 48 px; Back, reload, Kept, a colour edit with Colour locked and unlocked all held. Export 9:16: Clean Brutalist 37 ms, Vaporwave 193 ms; Grunge 283, 593; Glitch 163, 436.
- `npm run sheet`: exit 0, 13:16 to 13:18. `pairings NOT LOADED` 15/16 Swiss, 7/8 Postmodern, 8/10 Brutalist, 7/8 Vaporwave (Google Fonts blocked, Carried R3, H3): every Vaporwave cell drew in Unbounded, every Brutalist cell in Anton or Archivo Black.

## Done-when, line by line

### R8. Brutalist, finished: 3 of 3 true

| Line | Now | Would a test fail if false? |
|---|---|---|
| The variety tests pass for Brutalist (tested) | True in every format, stub and real bundled fonts (numbers above). | Yes: `tests/graphics.test.ts:123` and the 20-window test `:139`; smoke enforces `brutal` (`tools/smoke.py:11`). |
| Every title line of four words or fewer spans the full inner width within 1% in the layouts that promise it (tested) | True on the stub measure; by eye true on every sheet cell with the bundled faces. | Yes on the stub: `tests/brutal.test.ts:106` (all eight layouts seen, 7 promise it). No check with real fonts (M5). |
| Sheets are in the family of `refs/brutal-*.jpg` and visibly wider in range | True by eye: rules, mono strip with format tag, full-width stretched lines, one line on a full-bleed accent bar, mono subtitle bar, ruled table; `refs-compare.jpg` matches the three refs closely. Wider: tilts, quarter turns, title up the edge, split, boxed, slab, screen, a band of blunt graphics. Clumsy cases in S2 and S4. Whether it looks good is Pedro's call. | By eye. |

### R9. Vaporwave, finished: 2 of 2 true

| Line | Now | Would a test fail if false? |
|---|---|---|
| The variety tests pass for Vaporwave (tested) | True in every format (numbers above). | Yes: `tests/graphics.test.ts:131`, `:139`, `:153`; smoke enforces `vapor`. |
| Sheets are in the family of `refs/vapor-*.jpg` and visibly wider in range | True by eye: gradient skies, horizon, chrome titles with outline and echoes, wide-tracked subtitle, pixel-face info window, centred mono caption; the pinned refs in `refs-compare.jpg` match (sky title over the sun in 3:4 and 9:16, info window on the floor). Wider: windows, tunnel, huge sun, orb, checker and wave floors, cut-in discs. The refs' own pairing (slit sun over a grid floor) is rare unpinned (M2). | By eye. |

### R10. Advanced mode: 5 of 5 true, as the row's line reads

| Line | Now | Would a test fail if false? |
|---|---|---|
| Every parameter of every style can be set and changes the design (tested) | True for every key the engine reads: every `params[...]` read in `src/engine` (`layout.*`, `graphics.*`, `vapor.*`, `type.*`, `pomo.paperEdge`, `g.pattern.kind`, `g.<graphic>.<param>`, finish strengths, marks allowed) has a control. Spec 10.3's margin and title weight, tracking and case outside Swiss, Postmodern's second graphic and cut-in, and the cropped title are not built; each is in Carried (R10 from R10, R10 from R8) waiting on Pedro or a Fable chat. | Yes: `tests/advanced.test.ts:46` fails on a control shown for a design it does not change, over every layout, tilted and turned; appcheck fails on a generated control not drawn. |
| Setting any parameter to either end of its range still passes 9.2 or the range is narrowed until it does (tested) | True; graphic share and Turn narrowed (R10 changelog). | Yes: `tests/advanced.test.ts:100` (every value, fails on a fallback too), `tests/graphics.test.ts:47` (library ends), smoke `advanced` with real fonts. |
| An edited colour set is in the spec, survives reload and Keep, is cleared by Shuffle when Colour is unlocked and kept when locked (tested) | True. | Yes: `tests/advanced.test.ts:185`; appcheck taps an edit through Colour locked, Shuffle and reload. |
| Nothing is written to any palette list (tested) | True. | Partly: `tests/advanced.test.ts:158` compares the in-memory `PALETTES` before and after; a palette list written to saved state would pass (M6). |
| Nothing scrolls and nothing wraps in Advanced at both screen sizes (tested) | True: 250 and 150 screens. | Yes: `tools/appcheck.py:219`. |

## Sheets

- `sheet-brutal-{light,dark}`: lines fill the width in every cell; 9:16 cells leave the story zones empty, as the ref. Cell 9 (9:16 alarm) has a small "123" over the title and cell 1 (1:1 riot, tilted) a small "7" on the disc row (S2). Cell 4 (1:1 alarm, split) sets "SIGNAL AND" on one line over a barcode with "NOISE" huge below: legal by the join rule.
- `variety-brutal`: wide range. Small numerals again: row 1 cell 8 ("8" under the green bar), row 2 cell 2 ("0" in the lines strip), row 2 cell 8 ("2" cut at the right edge) (S2). Row 1 cell 1 (split tilt): the tilted "NOISE" sits alone in the bottom left over black, a third of the page empty.
- `text-brutal`: 8 words set as three full-width lines, heavy, good legibility. One word: S4.
- `palettes-brutal`: every cell has the thin band (a sliver of slab with a speck under the title), Carried R12 (from R8) item 3, unchanged.
- `sheet-vapor-{light,dark}`, `variety-vapor`: titles legible on every sky; 9:16 titles somewhat narrower than the ref. Row 2 cell 4 of `variety-vapor` (orb tilt, sphere + mountains): M4. `palettes-vapor` (windows layout): the dark forms' fields are as bright as the light ones (M8).
- `text-vapor`: 8 words balanced on four lines in a window, no orphan; one word fine.
- `refs-compare`: Brutalist close to all three refs (1:1 sets "AND" in ink on the yellow bar where the ref has paper). Vaporwave 1:1 now draws a clump of large overlapping stars top left (M3).
- `marks-full`, `marks-light`, `finish-*`: nothing new for Brutalist or Vaporwave beyond the "123" (S2).

## App screens

`screen-*` at both sizes. Simple tabs and the Style tiles unchanged. Advanced: six tabs, page steppers 48 px, no label cut except the shortened swatch "Accent…" (M7); "STRENGTH" and "Grunge" are drawn smaller than their neighbours (shrunk to fit, as spec 10.1 allows). The saved Advanced screens show a state the app cannot reach, and none exist for Swiss or Brutalist (S3); probe 2 read the real rows in the app for Swiss, Brutalist and Vaporwave instead: Palette, Pairing and Layout steppers show the drawn value, Vaporwave Sky and Floor show "Auto" (S1).

## README

`README.md` line 7 ("What it does today") is stale (E1). The Status table names bundle 4's rows correctly; bundle 2 and 3 rows are stale (M1).

## Findings

### Error

**E1. `README.md:7`: "What it does today" does not describe the app.** It opens "A phone app in Simple mode", ends "The Advanced switch shows Simple's tabs until bundle 4", says nothing of Brutalist's or Vaporwave's layouts and graphics, nor of Advanced (six tabs, colour edit, finish strength, marks allowed), and says "export JPEG or PNG at three sizes" where export is 1x in three formats (smoke: 1080 x 1080, 1440, 1920; no size choice in `src/app/App.tsx`). CLAUDE.md: a row that changes what the app does updates "What it does today" in the same commit; R8, R9 and R10 each updated only Status. Fix: rewrite the paragraph from the R8, R9, R10 changelog lines: Brutalist (eight layouts by name, size classes, the band of 12 blunt graphics, a free strip for marks), Vaporwave (eight layouts, four without a horizon, the sky title rule, cut-ins), Shuffle's 59-design guard, Advanced as built (six tabs, what each holds, colour edit with repair and warning, strengths, marks allowed, Shuffle clears unless locked), export "JPEG or PNG at 1080 wide in 1:1, 3:4 or 9:16"; drop the "until bundle 4" sentence.

### Should-fix

**S1. `src/engine/advanced.ts:60`: Vaporwave Sky and Floor (and Swiss and Brutalist Second) steppers show "Auto", not what the design draws.** Spec 10.3: "a longer one is a stepper, which shows what the design draws while it is unset". The `drawn` map holds only `pick.layout`, `pick.pairing`, `pick.palette` and `pick.motif`. Probe: vapor title-sky, lagoon, unset: `SKY Auto`, `FLOOR Auto` while the Scene draws e.g. `["dots","grid",...]`. Fix: add `vapor.first` (the sky graphic, with a horizon), `vapor.second` (the floor or the layout's second) and `graphics.second` (the first cut-in's graphic) from the Scene, and extend `tests/advanced.test.ts` to assert every unset stepper shows a drawn value where one exists.

**S2. Brutalist draws "a huge numeral" as a few small digits.** Spec 8.3 lists a huge numeral among the blunt graphics. Seen small in 7 of the 48 cells of `sheet-brutal-*` and `variety-brutal`: `sheet-brutal-*` cell 9 (9:16 light and dark, alarm, seeds `{layout: 64352, colour: 839832, graphic: 10400672, type: 4032}`: "123" above the title) and cell 1 (1:1 riot, seeds `{1000, 2000, 3000, 4000}`: "7"); `variety-brutal` row 1 cell 8 (table-first, numeral + lines: "8"), row 2 cell 2 (title-top, lines + numeral: "0"), row 2 cell 8 (slab tilt, rules + numeral: "2" cut at the edge); `marks-full` brutal 9:16. Each reads as a stray. Carried R12 (from R8) item 2 guessed this and left it unchecked; it is confirmed. Fix in `src/engine/parts/graphics/brutal.ts` (the first-graphic choice, and the cut rule at line 91 for every cut shape, not only `strip`): no numeral in a box shorter than about a quarter of the canvas width, another band graphic instead; a test that fails on a numeral whose digit height is under that; update the Brutalist hash in `tests/snapshot.test.ts`.

**S3. `tools/sheet.py:161-162`: the Advanced screens are taken on a design the app cannot reach, and only for Postmodern and Vaporwave.** The design is the Swiss ref spec (`ref_specs()[1][1]`) with `style` overwritten by `app.load`, so its picks (palette cobalt, pairing sw-inter-tight, motif topo, layout graphic-below) and params (`graphics.cut: 0`, `layout.size`, `g.topo.*`) ride along: the Vaporwave screens show Palette "Auto" while Outrun is drawn, Cut in "0" pressed, the Graphic lock "Stars"; the Postmodern ones Layout "Auto". The app's `withStyle` clears these (`tests/advanced.test.ts:68`). A viewer cannot judge the Advanced tabs from them, and there are none for Swiss or Brutalist. Fix: build each design with the picks and params cleared (or tap the style tile), and add `('swiss', ...)` and `('brutal', ...)` to the list.

**S4. Brutalist one-word titles: the band takes most of the page.** `text-brutal.jpg` cells 1 to 3: "SIGNAL" is one stretched line of about a fifth of the height at 3:4 and a sixth at 9:16, under a band of three graphics drawn over each other (a green slab with a disc, asterisks cut in, arrows crossing the slab). Spec 8.3: "The title is the graphic", the block stretched up to 1.9. Legal; clumsy by eye. Fix: for a one- or two-word title let the size class stretch the lines toward 1.9 before the band gets height (`src/engine/parts/layout/brutal.ts`), or limit the band to one graphic when it is taller than the title. If Pedro does not mind it, move it to Carried R12 instead.

### Minor

**M1. `README.md:28-30`: Status rows for bundles 2 and 3 are stale.** Bundle 2 says "Pedro looks at Swiss before bundle 3", bundle 3 "bundle close next"; both bundles closed. Fix: "Done" with what is open (H2, H3).

**M2. The refs' Vaporwave (slit sun over a perspective grid floor) is rare unpinned.** In the 24 cells of `sheet-vapor-*` and the 24 of `variety-vapor` the slit sun and the grid floor never appear together; the sky disc is most often a checker, dots, rings or waves cut-in. Spec 8.4 allows all of them; whether the classic pairing should be weighted up is Pedro's call (H2). No code change asked.

**M3. `tools/refs.json`: the Vaporwave refs do not pin `g.stars.*`.** `refs-compare.jpg` "now vapor-1x1" draws a clump of large overlapping stars in the top left (count and size near the top of their ranges, spread low), unlike the ref. Fix: pin `g.stars.count`, `size`, `spread` to the defaults in the three vapor refs.

**M4. `src/engine/parts/graphics/vapor.ts:35-36`: mountains on layouts without a horizon.** `variety-vapor` row 2 cell 4 (orb, tilt, sphere + mountains): the polyline floats lower right on a blank field and reads as a stray zigzag; spec 8.4 names them "horizon mountains". Fix: drop `mountains` from the `sun-huge` and `orb` lists, or set them on the page foot as a horizon.

**M5. `tests/brutal.test.ts:106`: the 1% full-width rule is tested on the stub measure only.** Carried R3 item 5 covers the online pairings; nothing checks the bundled faces in headless Chrome. Fix: run the same line-length check in smoke over the bundled Brutalist pairings.

**M6. `tests/advanced.test.ts:158`: "nothing is written to any palette list" checks memory only.** Fix: also assert that `serialize(...)` after an edit holds the edit only under `pick.colours` and no palette list, and that `localStorage` keys are the known ones.

**M7. `src/engine/controls.ts:165`: the second accent's swatch label shortens to "Accent…".** `screen-360x640-adv-*-colour-1.png`: with two accents the labels read "Accent" and "Accent…". Fix: a shorter label for `accent2` and `accent3` ("Acc 2", "Acc 3") so it fits whole.

**M8. Vaporwave dark forms on the windows field are as bright as the light ones.** `palettes-vapor.jpg` bottom row (windows layout, waves field): sunset, miami, mint dark fields are saturated mid-tones, not a dark sky; on the horizon layouts (`sheet-vapor-dark`) the skies are dark. Pedro's call whether the field layouts should take the dark sky in dark mode; no change asked until then.

## Carried items seen still open

R12 (from R8) item 2 (now S2) and item 3 (thin band, every `palettes-brutal` cell); R10 (from R10) colour mixes, margin, weight, tracking, case, Postmodern second graphic; R10 (from R8) cropped title; R3. None closed or contradicted by this run.

## Verdict

**Fix.** 1 error, 4 should-fix, 8 minor. Every Done-when line of R8, R9 and R10 is true now; all three scripts passed on the first run.
