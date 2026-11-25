# Backlog

The next open bundle is the first numbered bundle below with a row not in Done. `docs/RUN.md` says how a chat works it. One chat works one whole bundle; a chat that stops early is resumed with the same starter and picks up at the first row not Done.

| Bundle | Rows | What you get |
|---|---|---|
| 1 | R1, R2, R3, R4 | The real engine, palettes with light and dark, 42 font pairings fetched online, the app frame and Simple mode, live on Pages |
| 2 | R13, R5 | Styles rebuilt as parts with the variety rules; Swiss finished. Pedro looks at Swiss before bundle 3. Closed 24 Nov 2026 |
| 3 | R6, R7 | Both Postmodern dialects finished Closed 24 Nov 2026; five finishes; marks |
| 4 | R8, R9, R10 | Brutalist and Vaporwave finished; Advanced mode with per-design colour edit |
| 5 | R14, R15, R16 | Photo with shuffled placement, photo treatments, export sizes and file types, the A format and A3 print |
| 6 | R17, R12 | Text layers with hierarchy; retouch from notes |
| 7 | R18 | Mix: crosses of two styles (experimental, Advanced) |
| 8 | R19 | Finishes retouched: Grunge as a real photocopy, stronger Grain, stronger VHS (Pedro, 24 Nov 2026, from bundle 3) |
| later | M | Motion, then the APK. Needs a Fable chat first (spec 11) |

Bundle numbers changed on 23 Nov 2026 when the old bundle 2 was split in two so Pedro can look at Swiss before Postmodern is built: old 2 is now 2 and 3, old 3 to 6 are now 4 to 7. Row ids did not change.

Row ids are never reused or renumbered: R5 to R10 and R12 keep the meaning they had when bundle 1's reviews and Carried items named them; R11 (my palettes, own fonts, spec in and out) was dropped on 23 Nov 2026; R13 to R18 are new.

## Carried

- **R3.** Needs a run where fonts.googleapis.com, fonts.gstatic.com and raw.githubusercontent.com are reachable (this workspace's proxy blocks Google Fonts). (1) `npm run smoke` must end `smoke: passed` with no `online checks SKIPPED`: every pairing passes 9.2 and 9.3 with its real fonts, and the used-pairing-offline check runs against Google itself. Review R3 S1, M5. (2) `python3 tools/fetch_fonts.py --check` must report 0 problems; if `Big Shoulders Display` or any other family fails, swap it for the family that replaced it as a `sources` alias in `src/data/pairings.json` (as `Archivo Expanded` is) and record the swap in the changelog. Review R3 S5; also confirm Archivo's wdth axis reaches 125. (3) `npm run sheet` must print no `pairings NOT LOADED` line, so the four `shots/pairings-*.jpg` show all 42 pairings; then Pedro looks at them, the Vaporwave sheet with Monoton, Syncopate and Krona One first. Review R3 S2. (4) Re-derive the vapor picked-fallback ceiling of 12 in `tests/proof.test.ts` from that run's real metrics. Review R3 M6. (5) For Brutalist, every pairing keeps every title line at full width with no fallback in the unpicked run, and the share of one-word-per-line titles is reported per pairing (the band is sized from the bundled faces only). Review R8 M7.
- **R12 (from R5).** (1) 19 of 300 Swiss designs are still flagged `empty` by the restored clumsiness rule (2 also `small graphic`): vertical, quarter-turned centred-low and lone-disc layouts look sparse; specs in `docs/tuning-R5.md`; `tools/tune.py` lists them. Review R5 S2. (2) The Yellow light palette has near-black accent and ink, so heavy waves draw as a solid black box (`shots/palettes-swiss.jpg`); the tuning rule counts it as covered. (3) Pedro to say from the phone whether the 19 and the Yellow waves matter. Fix with his Notes.
- **R12 (from R6).** 24 Nov 2026, found by R6. The tuning pass on Postmodern (`python3 tools/tune.py pomo 300`, real bundled fonts) still flags 9 of 300 (8 `empty`, 4 `small graphic`): 7 photocopy (copy-column, copy-centre, copy-low, copy-cover, copy-stack; 3:4 and 9:16), 2 ice cream (title-middle). In 9:16, ice cream `title-side` and photocopy designs with narrow serif words leave the title smaller than the refs. Review R6 M9 adds five legal but clumsy seeds, 9:16 and 3:4 titles small over an empty page: `sheet-pomo-photocopy` cell 6 (9:16 light, seeds 44695, 528845, 6503845, 5555, copy-centre tilt, riso), cell 8 (3:4 dark, 60533, 738303, 9103263, 5617, copy-column quarter, milano), cell 12 (9:16 dark, 92209, 1157219, 14302099, 5741, copy-column, lilac); `sheet-pomo-icecream` cell 6 (9:16 light, 44695, 528845, 6503845, 5555, title-middle tilt, riso), cell 12 (9:16 dark, 92209, 1157219, 14302099, 5741, title-side, lilac). Seeds as the review found them, before the R6 fixes moved the photocopy title. Pedro to say from the phone whether they matter; fix with his Notes.
- **R10 (from R8).** 24 Nov 2026, found by R8. The cropped title of spec 8.3 (Advanced only, off by default) is not built; it needs a rule 1 waiver for the title (9.2), written into spec 8.3 by Pedro or a Fable chat, before R10 builds it and its control. Review R8 S3. R10 (25 Nov 2026) did not build the cropped title or its control: rule 1 of spec 9.2 has no written waiver in spec 8.3 from Pedro or a Fable chat.
- **R12 (from R8).** 24 Nov 2026, found by R8. (1) One Brutalist design in 600 (3:4 boxed, quarter turn, stub measure) still gets two marks, not three: the full-bleed accent bar blocks the edge strip; the marks test allows at most 1. (2) Brutalist light, 9:16 Alarm cell: a small "123" shows over the title; review R8 M4 covered numeral cuts only, so it is probably a numeral drawn as the main band graphic, not checked. (3) `python3 tools/tune.py brutal 300` flags 102 of 300 (47 empty, 84 small graphic), mostly the thin band in the screen layout and tilted pages; small titles in condensed faces can join into one line, so a 9:16 title can look small. Pedro to say from the phone whether they matter; fix with his Notes.
- **R16 (from R7).** 24 Nov 2026, found by R7. Marks and finishes are sized at 1080 wide: the finishes scale with the canvas (`u = W / 1080`), the marks are Scene items in 1080 units; when R16 draws 2x, 3x and print, check both draw at the export size (spec 10.1: finishes are generated at the export size so grain stays fine).
- **R12 (from bundle 3).** 24 Nov 2026, found by the bundle 3 viewer fixes (the copier pixel check of review bundle 3 M5). In photocopy the boxed title word's toner box is drawn with the plates, before every title word, so an earlier word that collides with it lays its paper halo over the box: there the boxed word's paper letters sit on paper. Read in cells on pixels without the copier pass, 20 of 1200 photocopy designs (smoke, N 200, cycle variants) have a boxed-word cell under 3:1 (1.07 to 2.96); rule 4 on the Scene does not see it (it reads the box as behind the word). The copier pass takes none lower (smoke reports these cells and fails only on cells the pass took under). Fix in R12: keep earlier words' halos off the boxed word's box (push the boxed word down as COVER does, or knock the halos out of the box), then make smoke fail on these cells too.
- **R12 (from R9).** 24 Nov 2026, found by R9 (the builder's tuning pass). `python3 tools/tune.py vapor 300` flagged 12 of 300 at the build: 9 `small graphic`, 3 `tiny title`. After the R9 review fixes the same run flags 10 (7 `small graphic`, 3 `tiny title`, 1 `empty`; one design can carry two). Pedro to say from the phone whether they matter; fix with his Notes.
- **R10 (from R10).** 25 Nov 2026, found by R10 (review R10 E1). Spec 10.3 lists a margin control on the Layout tab; it is not built. Each style fixes its margin in its own section (8.1 "one margin, 72 px at 1080"; 8.3 "about 48 px"), so a margin control contradicts the style rules: Pedro or a Fable chat to say whether Advanced may move a style's margin and over what range, then build it as `layout.margin` with its 9.2 test.
- **R10 (from R10).** 25 Nov 2026, found by R10 (review R10 E1). Spec 10.3's title weight ("where the family has it") is not built. A pairing names one display weight; other weights of the family are fonts the app does not fetch for that pairing, and spec 6 forbids laying out with a face that is not loaded. Needs: the weights each display family offers listed in `src/data/pairings.json`, fetched with the 4 s wait of spec 6, a `type.weight` key per type part, and its 9.2 test with real fonts.
- **R10 (from R10).** 25 Nov 2026, found by R10 (review R10 E1). Tracking (`type.track`) is built for Swiss only, the one type part that sets the title's tracking (8.1 "tight tracking on the title"). Brutalist (lines scaled to the full width, 8.3), Postmodern (strips, tiles, per-word faces) and Vaporwave set the title at no tracking; a control there needs the type part to read a tracking first, and the range found by its 9.2 test.
- **R10 (from R10).** 25 Nov 2026, found by R10 (review R10 E1). A title case control (spec 10.3: as typed, upper, lower) is built for Swiss only. Brutalist, Postmodern and Vaporwave set the title in upper case by their own rules (8.2, 8.3, 8.4; photocopy sets a case per word): Pedro or a Fable chat to say whether Advanced may override a style's case.
- **R10 (from R10).** 25 Nov 2026, found by R10 (review R10 E2). Postmodern has no second-graphic picker and no cut-in control: its graphics part cuts nothing into a first graphic (ice cream scatters five to eight shapes, photocopy lays four to six found graphics, spec 8.2), so 8.0's combination rule is not built for it and there is no second to pick. Pedro or a Fable chat to say what "second graphic" and "how it is cut in" mean for each dialect; then build them as Swiss and Brutalist have them (`graphics.second`, `graphics.cutShape`).
- **R10 (from R10).** 25 Nov 2026, found by R10 (review R10 M1). Colours a style mixes from two roles at layout time (photocopy contours and tape) keep the palette's mix after a colour edit: the edit swaps role colours only, so those mixes are drawn from the old colours. The Postmodern faint pattern's recorded fill is now mixed again from the edited roles (it is drawn from them); contours and tape need the same, mixed at paint time or again in `src/engine/recolour.ts`.
- **R10 (from R10).** 25 Nov 2026, found by R10. Smoke's offline font check "network off, unused sw-hanken picked: drawn with the default, note shown" is flaky offline: it can fail once and pass on a rerun with nothing changed. Find why (the service worker cache or the 4 s wait racing the pick) and make it deterministic.

## By hand (Pedro)

- **H3. Run the online type checks.** Where Google Fonts is reachable (your computer): `npm ci`, `npm run smoke`, `python3 tools/fetch_fonts.py --check`, `npm run sheet`; report the output or send it as `Notes:`. Detail in Carried R3. Open until done.
- **H4. Try the A3 export on the phone** once bundle 5 lands: export a design with a photo and Grunge at Print size, and say whether it saves and how long it takes.
- **H5. Shuffle with Grunge on the phone.** Turn Grunge on, tap Shuffle a dozen times, and say whether the stage lags (review R7 M6: under a 4x CPU throttle in headless Chrome one 3:4 Grunge render took 1.24 s and a Clean one 0.17 s in the R7 fix smoke).
- **H2. Look and use.** After each bundle, shuffle each style on the phone for a few minutes and send what is off in the next starter's `Notes:` line. Brutalist: turning Marks on keeps a strip at the canvas edges free for them, so the title shrinks and moves when Marks flips; say whether that bothers you (review R8 M2). Open until Pedro says done.

## Bundle 3: Postmodern, finishes, marks

Read spec 7, 8.0, 8.2, 8.5 and 8.7, `docs/design/elements.md`, and look at `docs/design/refs/pomo-*.jpg` and every `docs/design/refs/v2-grunge-*.jpg`. The spike's `grunge` and `photocopy` functions in `docs/archive/spike/engine.js` are the reference for the photocopy dialect: port the ideas, not the code.

## Bundle 4: Brutalist, Vaporwave, Advanced

Read spec 5, 8.0, 8.3, 8.4 and 10.3.

## Bundle 5: photo and export

Read spec 3 (formats), 8.9, 9.4 and 10.1 (export sheet).

### R14. Photo

- Choose a photo from the phone; keep it on the device as spec 8.9 says; Remove.
- Roles and crop decided by the layout stream in every style; Layout lock holds them; New crop.
- Text over a photo: plate, scrim, or measured contrast.
- Simple and Advanced Photo tabs.

**Done when:** with a test photo, 9.2 passes for every style, format and role (tested); 30 shuffles give at least 10 distinct role-and-crop results per style (tested); the photo survives reload (tested); no network request carries image data (tested); a portrait and a landscape photo both cover every box they are given (tested).

### R15. Photo treatments

- Colour, monochrome, duotone, halftone, threshold, posterise, dither; picked by the graphic stream or by hand; parameters in Advanced; each style's allowed list.
- Finishes and the copier pass over a photo.

**Done when:** each treatment is deterministic (tested); duotone and posterise use only palette colours (tested); treatment time at 1080 x 1920 is recorded; sheets show one photo in every treatment under every style.

### R16. Export

- The export sheet of spec 10.1 in full: formats, 1x, 2x, 3x, JPEG, PNG, WebP.
- The A format across the engine (layouts, safe areas, sheets, invariants).
- Print: A3 at 300 dpi, the bleed option, strip rendering, the honest failure message, the sRGB line, the photo pixel count.

**Done when:** every combination of format, size and file type gives a file of exactly the stated pixels (tested); a strip-rendered export is pixel-identical to a single-canvas one of the same spec (tested, at 3x); the A3 render finishes in headless Chrome with time and peak memory recorded; 9.2 passes for format A in every style (tested). Whether the phone manages A3 is for Pedro to try: say so under By hand.

## Bundle 6: text layers, retouch

Read spec 8.6.

### R17. Text layers

- The layer list, the six levels, add, remove, reorder, up to 8; each style's treatment and places per level; migration from the four slots.

**Done when:** every v1 design in Kept opens and draws the same layout after migration (tested on the Scene); 9.2 passes for 1 to 8 layers in every mix of levels, per style (tested over 200 seeds); a layer that cannot fit is flagged, never dropped (tested); the Text tab fits without scrolling at 8 layers (page chips) (tested).

### R12. Retouch

Needs Pedro's notes to run. Works every note and everything in Carried.

## Bundle 7: mix

Read spec 8.7 and 8.8.

### R18. Mix (experimental)

- Crosses of two styles by part, in Advanced only, labelled Experimental; the per-part parent switches; the fallback to parent A's part; the pair table.
- A tuning pass per pair (six pairs), with sheets; pairs that only make mud are switched off, each with a reason in the changelog.

**Done when:** every allowed pair passes 9.2 over 200 seeds in every format (tested); a failed part falls back and the design still draws (tested); Mix is unreachable in Simple (tested); a sheet per pair exists. Which crosses are worth keeping is Pedro's call.

## Bundle 8: finishes retouched

Read spec 7.1 and `docs/design/elements.md`; look at `docs/design/refs/v2-grunge-*.jpg` and `shots/finish-*.jpg`. Pedro's verdict on the bundle 3 finishes, 24 Nov 2026, after looking at the sheets: "The grunge only puts a black ragged border on the page, it's nothing like a photocopy. The grain could be stronger, the glitch is good, the vhs also could use more oomph." Glitch stays as it is.

### R19. Finishes retouched

- **Grunge** becomes a photocopy of the whole page, not a border: toner speckle and dropout across the page, streaks and banding along the copier's scan direction, crushed contrast, uneven toner density, dust and hair, with the edge as one part of it. Port ideas from the spike's `grunge` and `photocopy` functions in `docs/archive/spike/engine.js`; the photocopy dialect's own copier pass (spec 8.2) stays separate and Grunge must not double it.
- **Grain** stronger: visibly present at 1x on a phone at Simple's default, with the strength dial (`finish.<name>.strength`, Carried R10 from R7) still scaling it.
- **VHS** stronger: more tracking noise, chroma bleed, head-switching band and scanline weight, more visible at the default strength.
- Glitch unchanged except where the shared two-pass code requires.

**Done when:** at the default strength each of Grain, Grunge and VHS differs from Clean by more than a stated pixel-difference threshold over the page, measured over 100 seeds per style (tested); Grunge marks the interior of the page, not only the edge: the share of changed pixels in the central 60% is at least a stated fraction of the border's (tested); the two-pass rule, the 3:1 text guard and "VHS and Glitch leave text ink as Clean" still hold for all five finishes over the same seeds as R7's tests (tested); export time for 9:16 with each retouched finish recorded and not more than twice the R7 figures (Grunge photocopy 688 ms) without a changelog line saying why; sheets show every style under every finish and are compared with `refs/v2-grunge-*.jpg`. Whether the finishes now read as a photocopy, as grain, as VHS is Pedro's call.

## Done

One line per closed row: id, title, date closed, chats it took, review file.

- **R10. Advanced mode.** 25 Nov 2026, 1 chat (bundle 4; builder, reviewer and fixer ran as separate Opus 5.5 agents). Review R10 applied (fix: 2 errors, 5 should-fix, 8 minor; all 15 applied by the fixer, none rejected, two narrowed: the graphic share range and the Turn options); Carried R10, R10 (from R4), (from R6), (from R7) and (from R9) cleared; see `docs/CHANGELOG.md` and `docs/reviews/R10.md`.
- **R9. Vaporwave, finished.** 25 Nov 2026, 1 chat (bundle 4; the builder, reviewer and fixer ran as separate Opus 5.5 agents). Review R9 applied (fix: 0 errors, 5 should-fix, 9 minor; S1 to S5 and M1 to M8 by the fixer, M9 by the main chat at close, none rejected); Carried R9, R9 (from R13) and the R1 refs line cleared; see `docs/CHANGELOG.md` and `docs/reviews/R9.md`.
- **R8. Brutalist, finished.** 24 Nov 2026, 1 chat (bundle 4). Review R8 applied (fix: 1 error, 5 should-fix, 8 minor; 12 of 14 applied, M2 and M8 left to the main chat and done at close, none rejected); Carried R8, R8 (from R13) and R8 (from R7) cleared; see `docs/CHANGELOG.md` and `docs/reviews/R8.md`.
- **Bundle 3 viewer check.** 24 Nov 2026. Fix: 0 errors, 2 should-fix, 5 minor; 7 applied, 0 rejected. `docs/reviews/bundle-3.md`.
- **R7. Finishes and marks.** 24 Nov 2026, 1 chat (bundle 3). Review R7 applied (fix: 2 errors, 3 should-fix, 7 minor; 12 of 12 applied, M6 at this close, none rejected); Carried R7 and R7 (from R6) cleared; see `docs/CHANGELOG.md` and `docs/reviews/R7.md`.
- **R6. Postmodern, both dialects.** 24 Nov 2026, 1 chat (bundle 3). Review R6 applied (fix: 2 errors, 7 should-fix, 10 minor; 19 of 19 applied, none rejected); Carried R6 (from R13) and R6 (3:4 lower 40%) cleared; see `docs/CHANGELOG.md` and `docs/reviews/R6.md`.
- **Bundle 2 viewer check.** 24 Nov 2026. Fix: 0 errors, 2 should-fix, 6 minor; 7 applied, M6 by the main chat. `docs/reviews/bundle-2.md`.
- **R5. Swiss, finished.** 24 Nov 2026, 1 chat (bundle 2). Review R5 applied (fix: 0 errors, 7 should-fix, 5 minor, 12 of 12 applied); Carried R5 items and R13 items 1 to 5 cleared; see `docs/CHANGELOG.md` and `docs/reviews/R5.md`.
- **R13. Parts and the variety engine.** 23 Nov 2026, 1 chat (bundle 2). Review R13 applied (fix: 0 errors, 5 should-fix, 4 minor); see `docs/CHANGELOG.md` and `docs/reviews/R13.md`. Variety tests report, and fail for every style until its own row.
- **Bundle 1 viewer check.** 23 Nov 2026. Fix: 0 errors, 2 should-fix, 7 minor; S2, M1 to M3 carried to R5, R6 and R9, the rest applied. `docs/reviews/bundle-1.md`.
- **H1. Turn Pages on.** Done by Pedro; the Pages workflow deployed on every close (R1 to R4). Live URL not opened by an agent.
- **R4. The frame and Simple mode.** 23 Nov 2026. Review R4 applied; see `docs/CHANGELOG.md` and `docs/reviews/R4.md`.
- **R3. Type.** 23 Nov 2026, built and reviewed; three online Done-when lines UNVERIFIED (Google Fonts blocked in the workspace), see Carried R3 and H3. `docs/reviews/R3.md`.
- **R2. Colour, light and dark.** 23 Nov 2026. Review R2 applied; see `docs/CHANGELOG.md` and `docs/reviews/R2.md`.
- **R1. The engine.** 23 Nov 2026. Review R1 applied; see `docs/CHANGELOG.md` and `docs/reviews/R1.md`. Refs line for Vaporwave 3:4 and 9:16 closed 25 Nov 2026 by R9 (sky title back over the sun, 9:16 info window on the floor; checked by review R9 and by eye on the sheets, Pedro's look still wanted). `swiss-blocks-9x16` lost its red block (an R1 choice; Pedro to look).
