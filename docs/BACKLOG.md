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
- **R8.** Brutalist 1:1 Anton (Klein, Alarm): title lines leave about a third of the width empty when height binds (`styles/brutal.ts`, `kx < 1`); spec 8.3 says every line fills the width. Review R1 M4.
- **R9.** A sky-title treatment that passes for every palette (dark plate band or wider outline) so the spike's sky layout comes back over the sun; revisit the outline next to the echoes (outline-as-ink choice). Vaporwave 1:1 caption crowds the subtitle (`vapor.ts`, caption anchored at `bot`); 3:4 Mint c0 sun cut by the edge with an empty floor. Review R1 S2, S4, M6.
- **R5.** Swiss 9:16 Cobalt and Pine: small text with dead ground between the rule and the story zone. Review R1.
- **R7.** Finish and Marks: only Clean and Off can be chosen until R7 draws the others (`DRAWN_FINISH`, `DRAWN_MARKS` in `src/app/App.tsx`); add each to its list as it draws, and drop the `appcheck.py` check that the rest are disabled. Measure the Style tab's four tile renders per change on a phone alongside the export timing; if Shuffle lags, start tile renders after a 150 ms delay (the `stop` flag already cancels stale ones). Review R4 S1, M7.
- **R10.** The Advanced switch now reads "Advanced" with its on state as the pressed edge, and still shows Simple's tabs; R10 gives it its six tabs. The Type lock shows only the display family; the full pairing name goes on the Type tab. Review R4 M4, M6.

## By hand (Pedro)

- **H3. Run the online type checks.** Where Google Fonts is reachable (your computer): `npm ci`, `npm run smoke`, `python3 tools/fetch_fonts.py --check`, `npm run sheet`; report the output or send it as `Notes:`. Detail in Carried R3. Open until done.
- **H2. Look and use.** After each bundle, shuffle each style on the phone for a few minutes and send what is off in the next starter's `Notes:` line. Open until Pedro says done.

## Bundle 1: engine, colour, type, frame

Read spec 3, 4, 5, 6, 9 and 10 in full before any row of this bundle.

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

- **R4. The frame and Simple mode.** 23 Nov 2026. Review R4 applied; see `docs/CHANGELOG.md` and `docs/reviews/R4.md`.
- **R3. Type.** 23 Nov 2026, built and reviewed; three online Done-when lines UNVERIFIED (Google Fonts blocked in the workspace), see Carried R3 and H3. `docs/reviews/R3.md`.
- **R2. Colour, light and dark.** 23 Nov 2026. Review R2 applied; see `docs/CHANGELOG.md` and `docs/reviews/R2.md`.
- **R1. The engine.** 23 Nov 2026. Review R1 applied; see `docs/CHANGELOG.md` and `docs/reviews/R1.md`.
