# Backlog

The next open bundle is the first numbered bundle below with a row not in Done. `docs/RUN.md` says how a chat works it. One chat works one whole bundle; a chat that stops early is resumed with the same starter and picks up at the first row not Done.

| Bundle | Rows | What you get |
|---|---|---|
| 1 | R1, R2, R3, R4 | The real engine, palettes with light and dark, 42 font pairings fetched online, the app frame and Simple mode, live on Pages |
| 2 | R13, R5 | Styles rebuilt as parts with the variety rules; Swiss finished. Pedro looks at Swiss before bundle 3. Closed 24 Nov 2026 |
| 3 | R6, R7 | Both Postmodern dialects finished (R6 and R7 closed 24 Nov 2026; bundle viewer check pending); five finishes; marks |
| 4 | R8, R9, R10 | Brutalist and Vaporwave finished; Advanced mode with per-design colour edit |
| 5 | R14, R15, R16 | Photo with shuffled placement, photo treatments, export sizes and file types, the A format and A3 print |
| 6 | R17, R12 | Text layers with hierarchy; retouch from notes |
| 7 | R18 | Mix: crosses of two styles (experimental, Advanced) |
| later | M | Motion, then the APK. Needs a Fable chat first (spec 11) |

Bundle numbers changed on 23 Nov 2026 when the old bundle 2 was split in two so Pedro can look at Swiss before Postmodern is built: old 2 is now 2 and 3, old 3 to 6 are now 4 to 7. Row ids did not change.

Row ids are never reused or renumbered: R5 to R10 and R12 keep the meaning they had when bundle 1's reviews and Carried items named them; R11 (my palettes, own fonts, spec in and out) was dropped on 23 Nov 2026; R13 to R18 are new.

## Carried

- **R3.** Needs a run where fonts.googleapis.com, fonts.gstatic.com and raw.githubusercontent.com are reachable (this workspace's proxy blocks Google Fonts). (1) `npm run smoke` must end `smoke: passed` with no `online checks SKIPPED`: every pairing passes 9.2 and 9.3 with its real fonts, and the used-pairing-offline check runs against Google itself. Review R3 S1, M5. (2) `python3 tools/fetch_fonts.py --check` must report 0 problems; if `Big Shoulders Display` or any other family fails, swap it for the family that replaced it as a `sources` alias in `src/data/pairings.json` (as `Archivo Expanded` is) and record the swap in the changelog. Review R3 S5; also confirm Archivo's wdth axis reaches 125. (3) `npm run sheet` must print no `pairings NOT LOADED` line, so the four `shots/pairings-*.jpg` show all 42 pairings; then Pedro looks at them, the Vaporwave sheet with Monoton, Syncopate and Krona One first. Review R3 S2. (4) Re-derive the vapor picked-fallback ceiling of 12 in `tests/proof.test.ts` from that run's real metrics. Review R3 M6.
- **R8.** Brutalist 1:1 Anton (Klein, Alarm): title lines leave about a third of the width empty when height binds (`styles/brutal.ts`, `kx < 1`); spec 8.3 says every line fills the width. Review R1 M4.
- **R9.** A sky-title treatment that passes for every palette (dark plate band or wider outline) so the spike's sky layout comes back over the sun; revisit the outline next to the echoes (outline-as-ink choice). Vaporwave 1:1 caption crowds the subtitle (`vapor.ts`, caption anchored at `bot`); 3:4 Mint c0 sun cut by the edge with an empty floor. Review R1 S2, S4, M6. The treatment must bring back the refs `vapor-3x4` and `vapor-9x16` (title in the sky over the sun; in 9:16 the info window on the floor); R1's refs line stays open for them until then. Review bundle 1 S1. The 1:1 info window covers the top left of the sun (vapor, 1:1, lagoon, light and dark, c0, seeds `{layout: 48514, colour: 630374, graphic: 7801254, type: 4186}`); an 8-word title at 1:1 gets a pale plate on the floor and an orphan last word (`shots/text-vapor.jpg`, fourth cell): fold into the title-legibility work. Review bundle 1 M2, M3.
- **R12 (from R5).** (1) 19 of 300 Swiss designs are still flagged `empty` by the restored clumsiness rule (2 also `small graphic`): vertical, quarter-turned centred-low and lone-disc layouts look sparse; specs in `docs/tuning-R5.md`; `tools/tune.py` lists them. Review R5 S2. (2) The Yellow light palette has near-black accent and ink, so heavy waves draw as a solid black box (`shots/palettes-swiss.jpg`); the tuning rule counts it as covered. (3) Pedro to say from the phone whether the 19 and the Yellow waves matter. Fix with his Notes.
- **R8 (from R13).** Brutalist never draws its band graphic with the default text (the title fills the area), so barcode, slab and asterisks are missing in 300 shuffles; 44 repeats in the first 60; title-top 60% fails. Update the Brutalist hash in `tests/snapshot.test.ts` when it changes. Review R13.
- **R9 (from R13).** Vaporwave variety at R13: 52, 44, 47 repeats in the first 60 (1:1, 3:4, 9:16); title-sky missing at 1:1; title-floor 100%, 65%, 87%. Update the Vaporwave hash in `tests/snapshot.test.ts` when it changes. Review R13.
- **R12 (from R6).** 24 Nov 2026, found by R6. The tuning pass on Postmodern (`python3 tools/tune.py pomo 300`, real bundled fonts) still flags 9 of 300 (8 `empty`, 4 `small graphic`): 7 photocopy (copy-column, copy-centre, copy-low, copy-cover, copy-stack; 3:4 and 9:16), 2 ice cream (title-middle). In 9:16, ice cream `title-side` and photocopy designs with narrow serif words leave the title smaller than the refs. Review R6 M9 adds five legal but clumsy seeds, 9:16 and 3:4 titles small over an empty page: `sheet-pomo-photocopy` cell 6 (9:16 light, seeds 44695, 528845, 6503845, 5555, copy-centre tilt, riso), cell 8 (3:4 dark, 60533, 738303, 9103263, 5617, copy-column quarter, milano), cell 12 (9:16 dark, 92209, 1157219, 14302099, 5741, copy-column, lilac); `sheet-pomo-icecream` cell 6 (9:16 light, 44695, 528845, 6503845, 5555, title-middle tilt, riso), cell 12 (9:16 dark, 92209, 1157219, 14302099, 5741, title-side, lilac). Seeds as the review found them, before the R6 fixes moved the photocopy title. Pedro to say from the phone whether they matter; fix with his Notes.
- **R10 (from R6).** 24 Nov 2026, found by R6. The Paper edge switch (spec 8.2, `params['pomo.paperEdge'] = false`) sits on the Look tab in Advanced, after Dialect, until R10 gives Advanced its own tabs; move it to the Type tab then (spec 10.3). Shuffle and New type already clear it unless Type is locked (review R6 S5, fixed in R6).
- **R10 (from R7).** 24 Nov 2026, found by R7. Spec 7.1 and 10.3: the engine reads a strength per finish from `params['finish.<name>.strength']` (0 to 1.5, 1 unset; `strengthKey` in `src/engine/finish.ts`), but no control writes it; R10 adds the dial to Advanced's Style tab. The same tab's picker of which marks are allowed (spec 10.3) has no engine value yet: `MARKS_OF` in `src/engine/marks.ts` is the per-style list it would narrow.
- **R16 (from R7).** 24 Nov 2026, found by R7. Marks and finishes are sized at 1080 wide: the finishes scale with the canvas (`u = W / 1080`), the marks are Scene items in 1080 units; when R16 draws 2x, 3x and print, check both draw at the export size (spec 10.1: finishes are generated at the export size so grain stays fine).
- **R8 (from R7).** 24 Nov 2026, found by review R7, Legal but clumsy. Brutalist 1:1 and 3:4 at full: the underline bar's micro label sits in the 20 px between the last title line and the subtitle bar, where it reads as a stray; spec 7.2 wants it beside the bar on the free side, so skip the bar where there is none. Also at light 28 of 600 Brutalist designs (stub measure) still got two marks, not three (the test allows 5%): the ruled page had no room for barcode or slashes there; since the bundle 3 viewer fixes slashes step down to 28 px and 0 of 600 get fewer than three.
- **R12 (from bundle 3).** 24 Nov 2026, found by the bundle 3 viewer fixes (the copier pixel check of review bundle 3 M5). In photocopy the boxed title word's toner box is drawn with the plates, before every title word, so an earlier word that collides with it lays its paper halo over the box: there the boxed word's paper letters sit on paper. Read in cells on pixels without the copier pass, 20 of 1200 photocopy designs (smoke, N 200, cycle variants) have a boxed-word cell under 3:1 (1.07 to 2.96); rule 4 on the Scene does not see it (it reads the box as behind the word). The copier pass takes none lower (smoke reports these cells and fails only on cells the pass took under). Fix in R12: keep earlier words' halos off the boxed word's box (push the boxed word down as COVER does, or knock the halos out of the box), then make smoke fail on these cells too.
- **R10.** The Advanced switch now reads "Advanced" with its on state as the pressed edge, and still shows Simple's tabs; R10 gives it its six tabs. The Type lock shows only the display family; the full pairing name goes on the Type tab. Review R4 M4, M6.

## By hand (Pedro)

- **H3. Run the online type checks.** Where Google Fonts is reachable (your computer): `npm ci`, `npm run smoke`, `python3 tools/fetch_fonts.py --check`, `npm run sheet`; report the output or send it as `Notes:`. Detail in Carried R3. Open until done.
- **H4. Try the A3 export on the phone** once bundle 5 lands: export a design with a photo and Grunge at Print size, and say whether it saves and how long it takes.
- **H5. Shuffle with Grunge on the phone.** Turn Grunge on, tap Shuffle a dozen times, and say whether the stage lags (review R7 M6: under a 4x CPU throttle in headless Chrome one 3:4 Grunge render took 1.24 s and a Clean one 0.17 s in the R7 fix smoke).
- **H2. Look and use.** After each bundle, shuffle each style on the phone for a few minutes and send what is off in the next starter's `Notes:` line. Open until Pedro says done.

## Bundle 3: Postmodern, finishes, marks

Read spec 7, 8.0, 8.2, 8.5 and 8.7, `docs/design/elements.md`, and look at `docs/design/refs/pomo-*.jpg` and every `docs/design/refs/v2-grunge-*.jpg`. The spike's `grunge` and `photocopy` functions in `docs/archive/spike/engine.js` are the reference for the photocopy dialect: port the ideas, not the code.

## Bundle 4: Brutalist, Vaporwave, Advanced

Read spec 5, 8.0, 8.3, 8.4 and 10.3.

### R8. Brutalist, finished

- Everything in spec 8.3: the layouts, heavy pairings, the shared graphics at their heaviest, the variety rules, the tuning pass.
- Long titles: 8 words must still be heavy and legible.

**Done when:** the variety tests pass for Brutalist (tested); every title line of four words or fewer spans the full inner width within 1% in the layouts that promise it (tested); sheets are in the family of `refs/brutal-*.jpg` and visibly wider in range.

### R9. Vaporwave, finished

- Everything in spec 8.4 including the layouts with no horizon, the variety rules, the tuning pass, title legibility over the busiest part of the sky and floor.

**Done when:** the variety tests pass for Vaporwave (tested); sheets are in the family of `refs/vapor-*.jpg` and visibly wider in range.

### R10. Advanced mode

- Spec 10.3 without the Photo tab and Mix: controls generated from the parts' parameter lists, page chips, picks and params written to the spec, cleared by Shuffle unless locked.
- Colour tab: edit the design's three to five colours for this design only (spec 5), with the contrast handling and the warning.

**Done when:** every parameter of every style can be set and changes the design (tested); setting any parameter to either end of its range still passes 9.2 or the control's range is narrowed until it does (tested); an edited colour set is in the spec, survives reload and Keep, is cleared by Shuffle when Colour is unlocked and kept when locked (tested); nothing is written to any palette list (tested); nothing scrolls and nothing wraps in Advanced at both screen sizes (tested).

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

## Done

One line per closed row: id, title, date closed, chats it took, review file.

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
- **R1. The engine.** 23 Nov 2026. Review R1 applied; see `docs/CHANGELOG.md` and `docs/reviews/R1.md`. Refs line open for Vaporwave 3:4 and 9:16: the title moved from the sky to the floor, and the 9:16 info window from the floor to the top left (sky titles rejected while any palette cannot carry them); see Carried R9. `swiss-blocks-9x16` lost its red block (an R1 choice; Pedro to look).
