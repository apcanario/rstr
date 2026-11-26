# Review bundle 5: viewer check (R14 Photo, R15 Treatments, R16 Export)

Viewer: an Opus 5.5 agent, fresh to the bundle, on the final build. Bundle base `6467904`, HEAD `2dfa1f9`. Read `CLAUDE.md`, `docs/SPEC.md` 3 (Formats), 8.9, 9.4 and 10.1 (export sheet, the "Built at R16" note), the Done-when lines as quoted in `docs/reviews/R14.md`, `R15.md` and `R16.md`, `README.md`, and the code behind 8.9 and the R16 note. No source file changed.

## What ran

Each command ran detached with its own log, one at a time.

- `npm run check`: passed. `tsc` clean; vitest 21 files, 319 passed, 1 skipped, 1491 s; build clean (`/tmp/view-b5-check.log`, `exit 0`).
- `npm run smoke`: passed, 3 online checks SKIPPED (Google Fonts unreachable, Carried R3) (`/tmp/view-b5-smoke.log`, `exit 0`). The session restarted while smoke was running. The smoke process survived and finished, so it was not rerun. The sw-hanken offline check (Carried R10) passed this run. Lines this review rests on:
  - `9.2 <style> A  2800 designs, 0 fallbacks, 0 failing` for all four styles;
  - `photo 9.2: 3584 designs` (all four formats, every role and unpinned, both test photos);
  - `photo pixels: 246 text items ... (8 measured, 229 on a plate), none under spec 5`;
  - `photo pixels over calm areas: 784 text items, 60 measured`;
  - `photo shows (pixels): 96 designs; under 35% of the box: brutal box 3/4, brutal column 2/4, brutal disc 2/4, brutal ground 1/4, swiss ground 2/4` (all pinned roles, which spec 8.9 allows);
  - `photo treatments: 9.2 on 1568 designs`;
  - `photo copier: 210 ... 0 taken under`;
  - treatment times at 1080 x 1920 (ms, median of 5, first render in brackets): colour 30 (16), mono 40 (65), duotone 41 (61), halftone 134 (156), threshold 48 (54), posterise 60 (68), dither 45 (58);
  - `export sizes: 42 files ... each of exactly its pixels and type`;
  - `print density: ... (300, 300)` on every path;
  - `strips: 13 designs at 3x ... pixel-identical`;
  - bench: A3 JPEG one canvas 5,905 ms, peak 1,077 MB; A3 + bleed PNG one canvas 6,529 ms, peak 1,093 MB; the same in strips into a PNG 20,339 ms, 23.7 MB, peak 760 MB; A 3x JPEG 5,093 ms, peak 1,049 MB;
  - the photo flow: 288 requests (service worker included), none with a body, a long URL or a query, and 0 websockets;
  - the fullest export sheet at 360 x 640 laid out clean.
- `npm run sheet`: `exit 0` (`/tmp/view-b5-sheet.log`). Pairings NOT LOADED (swiss 15/16, pomo 7/8, brutal 8/10, vapor 7/8), Google Fonts blocked.
- Looked at:
  - every sheet in `shots/` (66), the bundle-5 ones at full size: `photo-roles`, `photo-swiss`, `photo-pomo`, `photo-brutal`, `photo-vapor`, `photo-treatments-ground`, `photo-treatments-box`, `photo-finishes`, `format-A`, `export-scale`, `export-print`, `refs-compare`;
  - all 181 screens: the 44 photo and export screens four to a page, the rest six to a page, and the three fullest export screens at full size.

## Done-when, line by line, on this build

### R14

| Line | True now? | Evidence |
|---|---|---|
| With a test photo, 9.2 passes for every style, format and role (tested) | Yes | Unit `tests/photo.test.ts:46` runs `FORMAT_LIST` (A included); smoke 3,584 designs, 0 failing, 0 fallbacks |
| 30 shuffles give at least 10 distinct role-and-crop results per style (tested) | Yes | `tests/photo.test.ts:119-139` keys on role, scale and offset, and checks that a constant crop fails |
| The photo survives reload (tested) | Yes | appcheck `photo 412x915: ... back after reload` |
| No network request carries image data (tested) | Yes | Context-level listener with the service worker, long URLs, queries, websockets and an export: 288 requests clean |
| A portrait and a landscape photo both cover every box they are given (tested) | Yes | `coverRect` test (`tests/photo.test.ts:36`) and the role sweep at :46 |

### R15

| Line | True now? | Evidence |
|---|---|---|
| Each treatment is deterministic (tested) | Yes | Kernel test in `tests/treat.test.ts`; smoke "determinism per style and treatment" with the cache cleared |
| Duotone and posterise use only palette colours (tested) | Yes | `tests/treat.test.ts:76-111`, posterise refused under three colours |
| Treatment time at 1080 x 1920 is recorded | Yes | R15 changelog entry; this run's figures above |
| Sheets show one photo in every treatment under every style | Yes | `photo-treatments-ground.jpg` and `-box.jpg`: 5 rows (both Postmodern dialects) x 7 |
| Carried R15 (from R14): copier pass over a photo | Yes | smoke `photo copier`: 0 taken under |

### R16

| Line | True now? | Evidence |
|---|---|---|
| Every combination of format, size and file type gives exactly the stated pixels (tested) | Yes | 42 files checked by browser and PIL |
| A strip export is pixel-identical to a single-canvas one at 3x (tested) | Yes | 13 designs, 0 channel values differ |
| The A3 render finishes in headless Chrome, with time and peak memory recorded | Yes | Bench lines above; the R16 changelog entry holds the close-of-row figures |
| 9.2 passes for format A in every style (tested) | Yes | `9.2 <style> A 2800 designs, 0 failing`, four styles; also in the marks, photocopy and transform runs |

All 14 lines are true on the final build.

## Spec and README against the code

- **Spec 8.9 "It shows".** It matches `src/engine/photo.ts` and `src/engine/styles/compose.ts:39-56`:
  - `PHOTO_FLOOR` 0.35;
  - text, rects and plated graphics cover; an unplated graphic counts half (`photoShare`);
  - two placements for `ground`, ten for the other roles, then the next role, else the best;
  - `ground` over ground-layer items and over any field or graphic above `GROUND_OVER` 0.8 of the canvas, and over every field on its second placement.

  One nuance is not in the spec: the copier pass is not counted as cover (M5).
- **"Built at R16" note.** It matches the code:
  - Print is A only and ticking another format moves to 3x (`src/app/App.tsx:758`, `:767`);
  - trim 3508 x 4961 and bleed 35/35/36/36 (`src/engine/formats.ts:22-25`);
  - bleed mirrored (`bleedSink`, `src/engine/export.ts:145`);
  - 512-row bands (`BAND`, `export.ts:42`);
  - strips joined on one canvas or written into a PNG;
  - JPEG and WebP greyed with "PNG may" (`App.tsx:693`);
  - the photo line (`App.tsx:698`).
- **README.** It names the photo, the seven treatments, export and A, but its "What it does today" is wrong in two places (S1).

## Findings

### Errors

None.

### Should-fix

**S1. README misstates what the app does now.** `README.md:7`, `README.md:20`.
- Line 7 says "a format (1:1, 3:4, 9:16)", then "export JPEG or PNG at 1x (1080 px wide at 1x; 2x, 3x, and A3 Print ..., JPEG, PNG or WebP, row R16; a fourth format, A, is 1080 x 1527)". It names three formats, then contradicts its own "JPEG or PNG at 1x". Format A appears only inside a parenthesis.
- The same paragraph says "Advanced is built (row R10): six tabs (Style, Layout, Graphic, Type, Colour, Text)", while its own R14 sentence and the app have a seventh, Photo. Line 20 ("Where it is going") also says six tabs.
- Export details are missing: several formats in one save, Save and Share, the honest failure.

Fix:
- Line 7: "pick a style ... and a format (1:1, 3:4, 9:16, or A, 1080 x 1527, the paper ratio)"; "export any of the four formats at 1x, 2x or 3x, and A at A3 Print (300 dpi, optional 3 mm bleed), as JPEG, PNG or WebP, saved or shared; sizes the phone cannot make are said so, never silently smaller".
- "seven tabs (Style, Layout, Graphic, Type, Colour, Text, Photo)" on lines 7 and 20.

**S2. No sheet or test puts a photo in format A.** Each of these picks the format with `["1:1", "3:4", "9:16"][... % 3]` or `FORMAT_LIST[i % 3]`:
- `tools/sheet.py:136` (`photo-roles` and the per-style photo sheets) and `:170`;
- `tools/smoke.py:365` (photo pixels), `:392` (photo treatments), `:437` (calm-area pixels and "photo shows");
- `tests/photo.test.ts:81`, `:104`, `:228`, `:256`;
- `tests/treat.test.ts:325`.

So text read on a photo's pixels, the treatments' 9.2 and pixel runs, the "It shows" pixel check and every photo sheet never meet A. A is the print format, where a photo matters most. Only the Scene-level photo 9.2 (`tests/photo.test.ts:46`, smoke `photo 9.2`) and the 3x export check cover A with a photo. The `format-A.jpg` sheet has no photo.

Fix:
- Use `FORMAT_LIST[i % 4]` (or `% FORMAT_LIST.length`) in those tests and `["1:1", "3:4", "9:16", "A"][n % 4]` in those tool lines.
- Add a photo row (ground and one cut-in, two treatments) to `format-A.jpg`.
- Rerun smoke and sheet.

**S3. The app's photo screens show a photo only under Vaporwave.** `tools/sheet.py:248-258` takes the per-style Advanced screens (`screen-*-adv-{swiss,pomo,brutal,vapor}-photo-*`) before the photo is added at `:294-310`. So all eight per-style photo pages show "Add photo" and greyed Treatment tiles. The only screens with a photo are `photo-simple` and `adv-photo-*`, on a Vaporwave design, where the photo is a pink halftone column that reads as one more pattern. Nobody, Pedro included, can see from the screens how the Photo tab and a photo look under Swiss, Postmodern or Brutalist.

Fix: add the photo before the per-style loop, or repeat the loop for the Photo tab after `:300` with the photo set, at both sizes. Keep one empty-state pair.

### Minor

**M1. Smoke's photo 9.2 line says "3 formats".** `tools/smoke.py:360` prints "4 styles x 3 formats". The loop runs `FORMATS`, which has four. Fix: print `len(FORMATS)`.

**M2. The photo pixels line does not add up.** `tools/smoke.py:377`: 246 items, 8 measured, 229 on a plate. The other 9 are counted as `masked` by `photoPixels` (`src/engine/pixels.ts:330`) but not printed. Fix: print the masked count too, so the three add up to the total.

**M3. Spec text still says two file types and three formats.**
- `docs/SPEC.md:305`, 9.2 rule 6, "a JPEG or PNG": WebP is built.
- `docs/SPEC.md:358`, "Before R16 the sheet has formats, JPEG or PNG, at 1x", now history.
- 9.1 says sheets span "the three formats".

These are a Fable or Pedro edit, not a builder's. Fix: rule 6 "a JPEG, PNG or WebP"; drop or past-tense the "Before R16" line; 9.1 "the four formats".

**M4. The Formats table in spec 3 is broken by a blank line.** `docs/SPEC.md:58`: an empty line before `| A | ...` ends the table, so the A row renders as a stray line. This is older than the bundle (present at `6467904`). Fix: delete the empty line.

**M5. 8.9 does not say the copier pass is not cover.** `photoShare` (`src/engine/photo.ts:262`) skips `pass` items, and its comment says so, but spec 8.9's list of what covers the photo does not. Fix: add "(the copier pass is a surface, not a cover)" to the "It shows" bullet.

**M6. Stale README Status row.** `README.md:30`, bundle 3: "bundle close next". Bundle 3 closed long ago. Fix at bundle 5's close together with row 5.

**M7. At 412 x 915 the Simple Photo tab's second page holds only two tiles.** `screen-412x915-photo-2.png`: Posterise and Dither sit in a mostly empty panel. Legal, but it reads unfinished. Fix: at 412 put the seven tiles plus Auto in two rows of four on page 1 where they fit, or move Change/Remove onto the tiles' page.

## Clumsy but legal (spec 9.5), for Pedro's eye

- **Brutalist photos still barely show.** `photo-brutal.jpg`:
  - cells 2 (3:4 title-top band), 3 (9:16 screen box) and 7 (1:1 title-top band) show a sliver or nothing that reads as a photo;
  - cell 10 (1:1 title-top ground): info labels on small yellow plates over a dither reads noisy.

  This is the known Carried R14 (spec) item. The smoke shows the floor missed only with pinned roles.
- **Swiss threshold and posterise in a box read as flat fields.** `photo-treatments-box.jpg`, Swiss row: threshold is a black field with dust, posterise a red field with a black hill. The synthetic test photo makes this worse.
- **Ground photos under Swiss sit under the wave mesh.** `photo-treatments-ground.jpg`, Swiss row: the red and black wave graphic covers roughly half the photo in every treatment.
- **Format A.** `format-A.jpg`: the same three cells R16's review listed (cell 1 Swiss light with a small title low under a large wave field, cell 7 Vaporwave light with a vertical title in a narrow window, cell 12 Postmodern dark c2 with overlapping title words). No new kind.
- **Export sheet at its fullest.** `screen-360x640-sheet-export-fullest.png`: the sheet covers about three quarters of the stage, so the design being exported is hardly visible. Legal (the sheet is modal); the text fits at one size, every control is 48 px or more.
- **Refs.** `refs-compare.jpg` shows no style drift in this bundle. No control under 48 px, no wrapped or cut text on any screen I looked at. The pairing name "Bricolage / Instrume…" shortens by rule.

Whether any of this looks good is Pedro's call; the scripts only prove it legal.

## Verdict

**fix.** 0 errors, 3 should-fix, 7 minor. All 14 Done-when lines are true on the final build and check, smoke and sheet pass. The fixes:
- the README's account of formats, export and the seven Advanced tabs (S1);
- photo coverage in format A (S2);
- app screens showing a photo under every style (S3).
