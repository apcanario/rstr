# Viewer check, bundle 2 (R13, R5)

HEAD 489a1fc. Viewer: Opus 5.5 agent. No source file changed. Read: `CLAUDE.md`, `docs/RUN.md` 4b, spec 8.0, 8.1, 8.5, 8.7, 9.4, the R13 and R5 rows (Done-when lines from `git show b6d1529:docs/BACKLOG.md`), `docs/CHANGELOG.md`, `docs/reviews/R13.md`, `docs/reviews/R5.md`.

## Scripts

- `npm run check`: exit 0. tsc clean, 12 files, 134 tests pass, 1 skipped; build 132.66 kB JS.
- `npm run smoke`, first run: **exit 1**, `smoke: FAILED, 1 problems; 3 online checks SKIPPED (not verified)`. The one problem: `FAIL app 412x915: reload did not bring back Advanced`; the next line of the same run printed that reload brought back Advanced. Everything else passed. See S1.
- `npm run smoke`, second run, no change in between: exit 0, `smoke: passed, 3 online checks SKIPPED (not verified)`. Swiss 9.2: 2800 designs per format unpicked, 8000 picked, 400 per palette form, 100 tilt and 100 quarter forced per format, all 0 fallbacks, 0 failing. 172 parameter ends, 1032 pixel checks, passed. Variety: Swiss 0 repeats, nothing missing, top layout graphic-below 16% in all three formats (enforced). The other three styles report the same numbers as R13 (Postmodern 1, 2, 0 repeats and title-top 55%; Brutalist 44 repeats, barcode, slab, asterisks missing, title-top 60%; Vaporwave 52, 44, 47 repeats, title-sky missing at 1:1, title-floor 100%, 65%, 87%).
- `npm run sheet`: exit 0. `pairings NOT LOADED` for 15/16 Swiss, 7/8 Postmodern, 8/10 Brutalist, 7/8 Vaporwave (Google Fonts unreachable; Carried R3, H3).

## Done-when, line by line

### R13. Parts and the variety engine: 4 of 4 true, one with a flaky script

| Line | Now | Would a test fail if false? |
|---|---|---|
| No style file reaches into another part's internals (tested by an import rule) | True. | Yes: `tests/parts.test.ts:50` walks `src/engine`, `:54` proves the rule catches each kind of breach, `:70` limits the shared exception to `parts/shared/brutal.ts`, `:102` every style is the five parts. |
| Every graphic's parameters at both ends of their ranges pass 9.2 (tested) | True. | Yes: the range-ends test in `tests/graphics.test.ts` (every text variant, 0 fallbacks, the value reaches every Scene with the graphic) and smoke's 172 ends with 1032 pixel checks. |
| The variety tests run and report (numbers recorded) | True. Smoke prints them per style and format; numbers above. | Yes: `tests/graphics.test.ts:87` tests the tests on hand-built rows. |
| `check` and `smoke` pass | `check` true. `smoke` failed once and passed once on the same build (S1). | They are the scripts. |

### R5. Swiss, finished: 3 of 3 true

| Line | Now | Would a test fail if false? |
|---|---|---|
| The three variety tests pass for Swiss (tested) | True in all three formats. | Yes: `tests/graphics.test.ts` "Swiss passes all three in every format" asserts `pass`, and `tools/smoke.py:162` fails on it for Swiss. |
| Every layout and graphic passes 9.2 (tested) | True. | Yes: the picked 9.2 runs (every `pick.layout` and graphic) in vitest and smoke, plus forced tilt and quarter. |
| A reviewer judges the sheets in the family of `refs/v2-swiss-*.jpg`; the first approved look (`refs/swiss-*.jpg`) still reachable | True, by eye. `shots/variety-swiss.jpg` and `sheet-swiss-*.jpg` have what the v2 refs have: one grotesque flush left, big accent fields and discs, cut-ins (topo in a disc, lines in a disc, bars with a disc), tilts, quarter turns with the title reading up the edge, a numeral used as a shape, split fields. `shots/refs-compare.jpg`: topo 1:1, 3:4, 9:16, bars, dots, no-text and blocks read as the same designs (bars 3:4 title now on two lines, not three; blocks red cell a little taller; topo 9:16 contours differ). Good or not is Pedro's call. | Judged by eye, no test. |

## README

`README.md` describes what the app does now: five parts, one shared graphics library, Swiss's eight layouts, twelve graphics, two positions per slot, tilt or quarter turn about one roll in three (each about one in six, `tests/swiss.test.ts:88`), the 25% title rule, size classes, cut-ins, the variety tests; Finish, Marks and Advanced limits; Status row 2 "Built". One gap: M5.

## Findings

### Errors

None.

### Should-fix

- **S1. Smoke is flaky: the reload check races the autosave.** `tools/appcheck.py:391-397`: it taps Advanced, calls `idle(pg)` and reloads. `idle` waits for the stage to draw the spec (`tools/common.py:52`), not for Preact to run the autosave effect (`src/app/App.tsx:271-283`, a `useEffect` on `advanced`), so a reload can land before `advanced: true` is in `localStorage`. Seen here: run 1 failed `app 412x915: reload did not bring back Advanced`, run 2 passed, same build. CLAUDE.md forbids a push with smoke failing, so a flaky smoke blocks or hides pushes. Fix: before `pg.reload()`, assert `aria-pressed == "true"` and wait for the save, e.g. `pg.wait_for_function('() => JSON.parse(localStorage.getItem(KEY) || "{}").advanced === true')` (with the app's store key and its serialisation), and do the same for the locks and Kept before reload.
- **S2. Swiss info values wrap: "23 Nov / 2026" on two lines.** `src/engine/parts/type/swiss.ts:88` fits a value with `maxLines: 2` starting at `infS`, so in a narrow column (column layout, three pairs, `cw = aw / 3`) the date breaks instead of setting on one line. None of the v1 or v2 Swiss refs wraps a value. Seen in `shots/sheet-swiss-light.jpg` and `-dark.jpg` cell 4 (1:1 yellow, column, seeds `{layout: 24757, colour: 316187, graphic: 3902127, type: 4093}`), `shots/variety-swiss.jpg` row 1 cell 1 and row 2 cell 5, and the three one-word cells of `shots/text-swiss.jpg`. Legal, not tidy. Fix: try one line first (`maxLines: 1`, down to `MIN.info`) and only then allow two; or drop to two columns of pairs when a value will not fit one line at `infS`.

### Minor

- **M1. A crosshair band jammed on the full-bleed panel.** swiss, 3:4, light and dark, Signal, full-bleed, topo + crosshairs, seeds `{layout: 56433, colour: 735103, graphic: 9100963, type: 4217}` (`shots/sheet-swiss-*.jpg`, row 2 cell 2): the band cut-in spans the page right on top of the text panel, and topo shards show in the strip between band and panel and down the right edge; it reads as debris. `src/engine/parts/graphics/swiss.ts:126-128` places a band anywhere in the visible box. Fix: keep a band at least one module clear of the panel, or put it in the outer half of the graphic box away from the text.
- **M2. Type only with a long title leaves the lower 40% bare at 3:4 and 9:16.** `shots/text-swiss.jpg`, the 8-word 3:4 and 9:16 cells (type-only, seeds `{layout: 78, colour: 89, graphic: 100, type: 5}`): info and title at the head, the caption rule at the foot, bare ground between. This is the R1 "dead ground between the text and the rule" complaint in another layout; the restored clumsiness rule does not list it (Carried R12 names vertical, centred-low and lone-disc). Fix: in type only, let the title grow into the room (oversize) or set it low against the foot; or add it to Carried R12 for Pedro's notes.
- **M3. Info with no rule over it when the caption goes to the head.** `src/engine/parts/type/swiss.ts:99-102`: the rule travels with the caption, so with the caption at the head and info at the foot (sheet 9:16 orange numeral cell; sheet 9:16 magenta cell has info at the head, the rule under the subtitle), info sits on no rule. Spec 8.1: info above a rule. Fix: draw the rule under info wherever info is, and keep the caption under it when they share an end.
- **M4. Crosshair and cut-in disc collide.** swiss, 1:1, magenta, centred-low quarter, crosshairs + disc, seeds `{layout: 1000, colour: 2000, graphic: 3000, type: 4000}` (`shots/sheet-swiss-*.jpg` cell 1): a crosshair ring sits over the disc and its satellite touches the ring. Fix: in front-of-cut drawing (`src/engine/parts/graphics/swiss.ts:160`), keep crosshair centres outside a disc cut-in, or accept as the Swiss "overlap" and leave it for Pedro.
- **M5. README: the Advanced switch is saved too.** `README.md:7` says "Design, Back steps, Kept and locks are saved"; the app also saves the Simple/Advanced switch (`src/app/App.tsx:270`). Fix: add "and the Advanced switch".
- **M6. Record not yet closed for the bundle.** `docs/PROCESS.md` has no bundle 2 entry and no reconstructed bundle 1 entry (RUN 4d says bundle 2 writes both); `docs/plan.html:106` still tags Session 2 `Next` (RUN 4e). Both are due before the bundle's last push; listed so they are not missed.

### Seen, already carried

Carried R12 (from R5): 19 sparse designs in `shots/tune-swiss.jpg` and the Yellow light waves as a black box in `shots/palettes-swiss.jpg` cell 4, both still as recorded. Postmodern, Brutalist and Vaporwave sheets unchanged from bundle 1 and R13 (Carried R6, R8, R9). Pairing sheets show the default for most pairings (Carried R3). App screens at 360 x 640 and 412 x 915: no cut labels, no control under 48 px, nothing new from this bundle; the text fields show the start of long values, as before.

## Verdict

**Fix.** 0 errors, 2 should-fix, 6 minor. Every Done-when line of R13 and R5 is true now and the tested lines have tests that would fail. Swiss reads as the family of the v2 refs and the first refs are reachable. S1 matters most: smoke failed once in two runs on the closed build, from a test race, not an app fault. S2 is the one visible Swiss flaw that repeats across sheets.
