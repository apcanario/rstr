# Backlog

The next open bundle is the first numbered bundle below with a row not in Done. `docs/RUN.md` says how a chat works it. One chat works one whole bundle; a chat that stops early is resumed with the same starter and picks up at the first row not Done.

| Bundle | Rows | What you get |
|---|---|---|
| 1 | R1, R2, R3, R4 | The real engine, palettes with light and dark, 42 font pairings fetched online, the app frame and Simple mode, live on Pages |
| 2 | R5, R6, R7 | Swiss and Postmodern finished, the five finishes, the marks layer |
| 3 | R8, R9, R10 | Brutalist, Vaporwave, Advanced mode |
| 4 | R11, R12 | My palettes, own fonts, spec in and out; retouch from notes |
| later | M, K | Motion, then photos, assets and kits. Each needs a Fable chat first (spec 11) |

## Carried

- **R3.** Needs a run where fonts.googleapis.com, fonts.gstatic.com and raw.githubusercontent.com are reachable (this workspace's proxy blocks Google Fonts). (1) `npm run smoke` must end `smoke: passed` with no `online checks SKIPPED`: every pairing passes 9.2 and 9.3 with its real fonts, and the used-pairing-offline check runs against Google itself. Review R3 S1, M5. (2) `python3 tools/fetch_fonts.py --check` must report 0 problems; if `Big Shoulders Display` or any other family fails, swap it for the family that replaced it as a `sources` alias in `src/data/pairings.json` (as `Archivo Expanded` is) and record the swap in the changelog. Review R3 S5; also confirm Archivo's wdth axis reaches 125. (3) `npm run sheet` must print no `pairings NOT LOADED` line, so the four `shots/pairings-*.jpg` show all 42 pairings; then Pedro looks at them, the Vaporwave sheet with Monoton, Syncopate and Krona One first. Review R3 S2. (4) Re-derive the vapor picked-fallback ceiling of 12 in `tests/proof.test.ts` from that run's real metrics. Review R3 M6.
- **R4.** App chrome: the coral wordmark letter, selected segments, Shuffle and the orange export icon go against spec 10.1 "dark and quiet"; follow `ui-*.jpg`. Review R1 M8. Move the interim Light/Dark button from the header (`App.tsx`) to the Look tab (spec 10.1, 10.2) and drop the `header .seed` margins in `app.css`. Review R2 M6.
- **R8.** Brutalist 1:1 Anton (Klein, Alarm): title lines leave about a third of the width empty when height binds (`styles/brutal.ts`, `kx < 1`); spec 8.3 says every line fills the width. Review R1 M4.
- **R9.** A sky-title treatment that passes for every palette (dark plate band or wider outline) so the spike's sky layout comes back over the sun; revisit the outline next to the echoes (outline-as-ink choice). Vaporwave 1:1 caption crowds the subtitle (`vapor.ts`, caption anchored at `bot`); 3:4 Mint c0 sun cut by the edge with an empty floor. Review R1 S2, S4, M6.
- **R5.** Swiss 9:16 Cobalt and Pine: small text with dead ground between the rule and the story zone. Review R1.

## By hand (Pedro)

- **H2. Look and use.** After each bundle, shuffle each style on the phone for a few minutes and send what is off in the next starter's `Notes:` line. Open until Pedro says done.

## Bundle 1: engine, colour, type, frame

Read spec 3, 4, 5, 6, 9 and 10 in full before any row of this bundle.

### R3. Type

- Pairings as data from `docs/design/pairings.md` (spec 6): check every family resolves from Google Fonts, swap or drop any that does not and say which in the changelog.
- The type seed and `pick.pairing`, per-style allowed lists.
- Online loading on demand, only the weights a pairing names; a service worker that caches fetched font files; the eight core families bundled; the 4 s fallback to the style's default pairing with a note.
- `tools/fetch_fonts.py` for the APK build: downloads every pairing's fonts and writes the licence texts.

**Done when:** every pairing of every style passes 9.2 with its real fonts loaded (tested, online); with the network off after one use, a used pairing still draws with its own fonts (tested); with the network off and an unused pairing picked, the design draws with the default pairing and the note shows (tested); layout never runs with a fallback system font (tested: the Scene records the families it measured with); changing only the type seed moves no graphic (tested); a sheet per style shows every pairing with the same other seeds.

### R4. The frame and Simple mode

- The frame of spec 10.1 and Simple mode of 10.2: header, stage, format, locks, panel, action row with Back, Shuffle, Keep and Export, tab bar; Kept sheet; export sheet with Save and Share.
- Style tiles as small live renders.
- The app-wide Simple/Advanced switch is present and remembered; Advanced shows Simple's tabs until R10.
- Autosave of the current design, Back steps and Kept.
- Screen shots of every tab and sheet at 360 x 640 and 412 x 915 in `npm run sheet`.

**Done when:** nothing scrolls at 360 x 640 or 412 x 915 (tested); every control is at least 48 px (tested); no text on a control wraps or overflows with the longest palette, pairing and style names (tested); a locked facet survives 50 shuffles (tested); Back restores the previous design exactly (tested); export gives files of the right pixels for all three sizes (tested); reload brings back the design, Back steps and Kept (tested).

## Bundle 2: Swiss, Postmodern, finishes

Read spec 7 and 8.1, 8.2, 8.5, and `docs/design/elements.md`.

### R5. Swiss, finished

- The five layouts, the six new graphics, two or three positions per text slot (spec 8.1, 8.5).
- A tuning pass: generate 200 designs, list the clumsy ones with their specs, tighten the rules until the list is short. Record what was tightened.

**Done when:** every layout and graphic passes 9.2 (tested); each layout and graphic appears on the sheets; the approved look in `docs/design/refs/swiss-*.jpg` is still reachable (the reference specs still draw recognisably the same designs). Whether it is good is Pedro's call.

### R6. Postmodern, finished

- The six new shapes, two more ground patterns, a second title treatment (letters on separate tiles), positions per slot (spec 8.2).
- The same tuning pass as R5.

**Done when:** as R5, against `docs/design/refs/pomo-*.jpg`; no shape is ever drawn over text (tested).

### R7. Finishes and marks

- The five finishes of spec 7.1 with the two-pass rule; the marks layer of spec 7.2 from `docs/design/elements.md`, at off, light and full; the Look tab's Finish and Marks controls.
- Export time measured in headless Chrome for the largest format with Grunge and with Glitch, recorded in the changelog.

**Done when:** the same spec gives identical pixels with each finish (tested); no finish takes a text item under 3:1 (tested); with VHS or Glitch the pixels inside every text item's ink are the same as with Clean (tested); no mark overlaps a text item at light or full, over 200 seeds per style (tested); no micro label contains anything the spec does not hold (tested against a list of allowed sources); sheets show every style under every finish and at each marks level.

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

- **R2. Colour, light and dark.** 23 Nov 2026. Review R2 applied; see `docs/CHANGELOG.md` and `docs/reviews/R2.md`.
- **R1. The engine.** 23 Nov 2026. Review R1 applied; see `docs/CHANGELOG.md` and `docs/reviews/R1.md`.
