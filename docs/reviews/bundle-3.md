# Viewer check, bundle 3 (R6, R7)

HEAD 9d60b38. Viewer: Opus 5.5 agent that had not seen the builds. No source file changed. Read: `CLAUDE.md`, spec 7, 7.1, 7.2, 8.0, 8.2, 8.5, 8.7, 10.1, the R6 and R7 Done lines in `docs/BACKLOG.md` and their original Done-when lines (`git show 1debd45:docs/BACKLOG.md`, Bundle 3), `docs/reviews/R7.md`, `docs/design/elements.md` (marks, micro labels), `README.md`. Looked at every sheet and screen of the `npm run sheet` run below against `docs/design/refs/pomo-*.jpg` and `v2-grunge-*.jpg`.

## Scripts

- `npm ci`, then `npm run check`: exit 0. tsc clean; 15 files, 189 tests pass, 1 skipped (359 s); build 187.95 kB JS.
- `npm run smoke`: exit 0, `smoke: passed, 3 online checks SKIPPED (not verified)` (Carried R3, not a finding). Engine checks 1079 s. The run was not interrupted by the session restart that stopped this viewer (one copy only, checked with `pgrep`). Postmodern 9.2: 2800 designs per format, 14400 picked, 400 per palette form, 100 per format with paper edge off, all 0 fallbacks, 0 failing. Marks light and full: 400 designs per style and format, 0 failing. Finishes: 200 designs, same pixels twice, VHS and Glitch 0/255 on fill and ring, nothing taken too low, guard put back 7 items. Export 9:16 (marks full, total): Grunge Swiss 343 ms, ice cream 454, photocopy 712, Brutalist 385, Vaporwave 523; Glitch 172, 210, 576, 172, 342; Clean photocopy 225 (copier pass alone 68 ms). 4x throttle 3:4: one render Clean 117 ms, Grunge 1149 ms; four tiles 456 to 579 ms. Variety: Postmodern 0 repeats, nothing missing, top layout title-bottom 10% in all three formats; ice cream alone 0 repeats (title-top 18%), photocopy alone 0 repeats (copy-stack 21%). Brutalist and Vaporwave fail as before, reported only (Carried R8, R9).
- `npm run sheet`: exit 0, 87 files. `pairings NOT LOADED` for 15/16 Swiss, 7/8 Postmodern, 8/10 Brutalist, 7/8 Vaporwave (Google Fonts blocked; Carried R3, H3). So most Postmodern designs drew with the core pairing; the photocopy "own face per word" was seen only with the faces this workspace has.
- One scratch probe (`/tmp/scratch/probe.py`, outside the repo) printed the Scene of the Brutalist case in S2.

## Done-when, line by line

### R6. Postmodern, both dialects: 4 of 4 true

| Line | Now | Would a test fail if false? |
|---|---|---|
| The variety tests pass for Postmodern counting both dialects, and each dialect alone meets the 60-shuffle test (tested) | True in all three formats (numbers above). | Yes: `tests/graphics.test.ts:111` asserts all three for both dialects together and, per dialect, `sixty` and nothing missing; `tools/smoke.py` fails on both (`ENFORCED` includes `pomo`, lines 258 and 267). |
| No shape or found graphic is drawn over text in ice cream (tested) | True. No shape over type in any sheet. | Yes: `tests/pomo.test.ts:86` fails on any graphic after the first text item and on rule 3, 100 designs; smoke 9.2 runs rule 3 on 2800 per format with real bundled fonts. Shapes under unplated text are allowed by the test (see M4). |
| In photocopy every title word passes contrast with the paper edge on (tested) | True on the Scene. | Yes: `tests/pomo.test.ts:227` checks every title word's halo is paper at `needRatio` or the word is paper on toner, and rule 4, over 200 seed sets; smoke 9.2 likewise. The check is on the Scene, before the copier pass; no pixel check of the copier pass itself (M5). |
| Sheets match `refs/pomo-*.jpg` and `refs/v2-grunge-*.jpg` in character | True, by eye. Ice cream: tilted strips in different fills with hard shadows, letters on tiles, serif italic on a highlight plate, mono info in a shadowed box, faint ground patterns, five to eight shapes, as `pomo-1x1`. Photocopy: paper, toner, one spot colour, per-word faces and cases, colliding lines, a boxed word, a sliced word, a spot ghost, found graphics (halftone, slab, tape, X marks, topo, register marks, redacted bar), cut-out subtitle strips, paper-label info, the caption three times fading, dark copier edges and streaks, as the v2-grunge refs. Titles are smaller than the refs in 9:16 and some 3:4 (Carried R12 from R6, still as recorded). Whether they look good is Pedro's call. | By eye, no test. |

### R7. Finishes and marks: 6 of 6 true, and the export timing is recorded

| Line | Now | Would a test fail if false? |
|---|---|---|
| The same spec gives identical pixels with each finish (tested) | True. | Yes: `tools/smoke.py:194-199` draws each of 200 designs twice through `__rstr.pixels` and fails on a difference; Clean is covered by 9.3. The kernels' seed tests are in `tests/finish.test.ts:31`. |
| No finish takes a text item under 3:1 (tested) | True. | Yes: `finishProof` reads each item in cells and smoke fails on `low` (`tools/smoke.py:211`), also on `rawLow` before the guard for VHS and Glitch; the review R7 seeds are in the cases; `tests/finish.test.ts:118` shows one lost cell fails. |
| With VHS or Glitch the pixels inside every text item's ink are the same as with Clean (tested) | True: 0/255 on fill and ring. | Yes: `inkDiff` and `ringDiff` fail the smoke at any non-zero count (`tools/smoke.py:205-208`). |
| No mark overlaps a text item at light or full, over 200 seeds per style (tested) | True as the test defines a text item (its glyph quad). A mark can sit on the plate a text item is set on (S2). | Yes for glyph quads: `tests/marks.test.ts:43` (600 designs per style and level) and smoke 9.2 with marks fail on `markOverlaps`; `:148` shows the check catches a mark on text. It cannot fail on S2. |
| No micro label contains anything the spec does not hold (tested against a list of allowed sources) | True. Sources: app, seed, format, style, palette, counter, all in `elements.md`'s list; no date. | Yes: `tests/marks.test.ts:96` (params against `LABEL_SOURCES`), `:111` (every string the marks draw, from a recording context), `:125` and `:134` (forged labels fail). |
| Sheets show every style under every finish and at each marks level | True: `finish-{clean,grain,grunge,vhs,glitch}.jpg` and `marks-{light,full}.jpg`, 4 styles x 3 formats each, same seeds, Postmodern alternating dialects; Off is every other sheet. | Sheets, no test. |
| Row bullet: export time for the largest format with Grunge and Glitch, recorded in the changelog | True: the R7 changelog entry gives per-style 9:16 totals; this run's numbers (above) are within about 20% of them. | Smoke prints them and fails over 8000 ms. |

## App screens

360 x 640 and 412 x 915, Look tab in Simple and Advanced, Postmodern: Light/Dark and Finish on page 1, Marks and the rerolls on page 2, Dialect on page 3, Paper edge beside Dialect in Advanced; the `1/3` stepper is one 48 px control. No label cut, nothing wraps; the Paper edge switch is a 52 x 48 px button (`src/app/app.css:73`) with a 40 x 24 drawn track. Smoke's appcheck: 47 screens at 412 x 915, no scroll, no spill, controls at least 48 px. The font note over the stage (`Eczar / Gentium offline`) is Carried R3.

## README

`README.md` describes what the app does now: both dialects with the Dialect control (Shuffle keeps it), six ice cream and five photocopy layouts (`src/engine/parts/layout/pomo.ts:21-22`), thirteen shapes, five patterns, ten found graphics, the paper edge and its Advanced switch, the copier pass, the five finishes with the two-pass rule and the 3:1 guard, tiles drawn Clean, marks at Off, Light and Full with the containers, and the label sources. Status row 3 says R6 and R7 closed, viewer check next, which is true at 9d60b38. No gap found.

## Findings

### Errors

None.

### Should-fix

- **S1. Ice cream subtitle wraps and leaves "system" alone on its own plate line.** `src/engine/parts/type/pomo.ts:86` fits the subtitle from `W * 0.066 * cap` with `maxLines: 2`, so it takes two lines at the start size before one line a little smaller, and the break leaves a one-word last line. Seen in `shots/sheet-pomo-icecream.jpg` cells 4 (1:1 dark, big-shape tilt, bubblegum), 6 (9:16 light, title-middle tilt, riso) and 11 (3:4 light, title-bottom tilt, arcade), and in `shots/variety-pomo.jpg` row 1 cell 7, row 2 cells 1, 2 and 7: about one ice cream design in four, mostly tilted ones. `refs/pomo-1x1.jpg` sets the subtitle on one line. Legal, clumsy: the orphan reads as a mistake. The same fault was S2 of bundle 2 in Swiss. Fix: try `maxLines: 1` first, down to about 0.75 of the start size, and only then allow two lines; when two are needed, break so the last line has at least two words.
- **S2. A mark sits on a text item's plate.** `src/engine/marks.ts:56` (`free`) keeps a mark 18 px off text glyph quads and off thin rules (`:280`, rects 16 px or less), but a text plate is neither, so a mark may land on it; `markOverlaps` (`:305`) tests glyph quads only, so no test can fail. Seen in `shots/marks-light.jpg`, Brutalist 3:4 dark (seeds `{layout: 56433, colour: 735103, graphic: 9100963, type: 4217}`, marks light): the slashes at (887, 1072)-(1080, 1136) cut into the right end of the subtitle bar (49, 1076)-(1031, 1160); the subtitle text ends at x 664. Spec 7.2: marks in free space only, never on a text item; the bar is the subtitle's container (spec 8.3). Fix: in `free()`, reject a box that overlaps any rect or graphic whose quad contains a text item's quad (Brutalist subtitle bar, ice cream highlight plate and info box, Vaporwave window, photocopy label and strips), except a container's own card; add those plates to `markOverlaps` and a test that a forged mark on a plate fails.

### Minor

- **M1. Marks land on graphics and read as debris.** `src/engine/marks.ts:66` (`busy`) counts overlapping graphics by their quads, and the candidate spots are corners and edges only (`:146`), so where every candidate touches a shape's quad the least busy one is still on a shape. Seen in `shots/marks-light.jpg` and `marks-full.jpg`: ice cream 3:4 light (lagoon) a grid with a black status cell over the yellow arc; Swiss 9:16 light (`marks-full.jpg`) a grid over the edge of the orange numeral. Legal. Fix: score by the graphic's ink in the box, not its quad, and skip the mark rather than place it over a shape where no bare candidate exists (light allows three).
- **M2. Micro labels have no contrast floor.** `src/engine/marks.ts:115` (`colours`) takes the role with the best minimum contrast against everything behind, with no minimum; a box straddling two backgrounds gets a colour that reads on neither. Seen in `shots/marks-full.jpg`, Postmodern 1:1 dark photocopy: "1:1 · 01 / 01" at the bottom in dim violet across purple tape and black, and the underline bar's label in dim teal; both almost invisible after the copier pass. Fix: for a label, require 3:1 against every colour behind it, else try the next spot, else drop the label.
- **M3. Long photocopy titles cut letters on both edges.** `shots/text-pomo.jpg`, 3:4 and 9:16, 8 words: "EIGHT PLAIN" and "WORDS MAKE" lose about half a letter at the left and at the right, and "poster title" its last letter. Spec 8.2 allows words to run "a little" off the canvas; both ends of one line at once reads as cropped, not cut and pasted. Legal. Fix: in `src/engine/parts/type/pomo-copy.ts`, let a line overhang one edge only, by at most about 0.3 em.
- **M4. Ice cream caption over a striped shape, unplated.** `shots/text-pomo.jpg`, 9:16, 1 word: the caption running down the right edge crosses the blue striped shape, so the small mono reads in broken pieces. It passes rule 4. Spec 8.2: shapes may sit behind text plates; the caption has none. Fix: keep shapes off the caption's edge strip (its box padded by one shadow offset), or put a ground plate under the caption where a shape is behind it.
- **M5. No pixel check that the copier pass keeps photocopy title words legible.** The R6 contrast line is checked on the Scene before the copier pass (`tests/pomo.test.ts:227`, smoke 9.2); `finishProof` compares a finish with Clean, and Clean already includes the copier pass, so a copier change that greyed the words under Clean would pass every check (review R7 E2 was the same failure through the restamp). Fix: a smoke check that reads each photocopy title word in cells on the Clean render against its paper halo (or the paper on its toner box) and fails under `needRatio`, over the 9.2 photocopy designs.

### Seen, already carried

- Carried R12 (from R6): small titles over a bare page in 9:16 and 3:4: `sheet-pomo-photocopy.jpg` cells 6 (9:16 light, copy-centre tilt, riso) and 8 (3:4 dark, copy-column quarter, milano), `sheet-pomo-icecream.jpg` cell 6 (9:16 light, title-middle tilt, riso), `finish-*.jpg` Postmodern 9:16 dark. Still as recorded.
- Carried R8 (from R7): the Brutalist underline-bar label in the 20 px between the last title line and the subtitle bar (`marks-full.jpg`, Brutalist 1:1 "1:1 · 01 / 01", 3:4 "BLACKOUT"). Carried R8: the Brutalist 1:1 accent line not full width.
- The R7 choices are visible as recorded: under Glitch and VHS a slid plate shows as a halo round its letters (`finish-glitch.jpg`, Postmodern 1:1 dark "Signal"); Glitch slices clamp at the edge.
- Carried R3: pairing sheets mostly NOT LOADED; the font note on the stage.

## Verdict

**Fix.** 0 errors, 2 should-fix, 5 minor. Every Done-when line of R6 and R7 is true now and every "(tested)" line has a test that would fail if it were false; the mark-overlap test is blind to text plates (S2). Check, smoke and sheet pass. The designs on the sheets are legal; S1 (an orphan subtitle word in about a quarter of ice cream designs) and S2 (a mark cutting into the Brutalist subtitle bar) are the clumsy ones a script did not flag. README is current.
