# RSTR spec

Settled on 23 Nov 2026. A builder follows this; a reviewer checks against it. Where it is silent, take the most reasonable reading and record the choice in the changelog.

## 1. What it is

A poster generator for a phone. Pick a style, tap Shuffle until something lands, type the words, export. The app composes type, colour and geometry inside a style's rules; a seed makes each result reproducible.

- **User:** Pedro only. Android phone, Chrome, portrait.
- **Form:** a web app on GitHub Pages, later the same code in a Capacitor APK.
- **Phase 1 (this spec): stills.** Phase 2 is motion, phase 3 is photos, assets and brand kits (section 10, outline only).

## 2. What it is not

- **No AI image generation.** Nothing calls a model. No server, no key, no cost per image.
- **No figurative illustration.** Graphics are procedural: geometry, pattern, line, gradient, texture. Pictures of things arrive in phase 3 as files Pedro uploads.
- **No free-form editor.** Nothing is dragged. Pedro chooses and tunes rules; the engine places things.
- **No licensed fonts.** Helvetica, Akzidenz and the like are never bundled.
- **No accounts, no sync.** Everything lives on the phone.

## 3. The design is data

A design is one JSON document, the **spec**. The image is never stored; it is drawn from the spec at any size.

```
{ "v": 1,
  "style": "swiss",              // swiss | pomo | brutal | vapor
  "format": "3:4",               // 1:1 | 3:4 | 9:16
  "mode": "light",               // light | dark
  "finish": "clean",             // clean | grain | grunge | vhs | glitch
  "marks": "off",                // off | light | full
  "seeds": { "layout": 1, "colour": 2, "graphic": 3, "type": 4 },
  "pick": { "palette": null, "pairing": null, "motif": null, "layout": null },   // null = the seed decides
  "params": { },                 // Advanced values, per style; absent = the seed decides
  "text": { "title":    { "on": true, "v": "Signal and noise", "pos": null },
            "subtitle": { "on": true, "v": "...", "pos": null },
            "info":     { "on": true, "v": [ { "k": "Where", "v": "Lisboa" } ], "pos": null },
            "caption":  { "on": true, "v": "...", "pos": null } } }
```

- **Four seeds, four independent streams.** Layout, colour, graphic, type. Changing one never changes what the other three produce (tested, 9.3). This is what Lock and the per-facet rerolls rest on.
- **A pick overrides its seed.** `pick.palette` set means the colour seed is ignored for palette choice, and so on.
- **Format, mode, finish and marks are not seeded.** Shuffle never changes them.
- **The same spec draws the same design** on the same device and build (tested).
- A spec with an unknown field or an older `v` is migrated or the unknown part ignored; it never crashes the app.

### Formats

| Format | Pixels | Notes |
|---|---|---|
| 1:1 | 1080 x 1080 | |
| 3:4 | 1080 x 1440 | Default |
| 9:16 | 1080 x 1920 | Text stays between y 260 and y 1600: the top 250 px and bottom 320 px belong to the story interface. Ground, graphics and marks may fill them. Same zones Pedro has used on his story posts. |

One spec, all three formats: the same palette, pairing, motif and words, laid out again for the ratio. It should read as one design in three sizes, not three designs.

## 4. The engine

Three stages, each a pure function, all in `src/engine/`:

1. **layout(spec, measure) -> Scene.** Decides everything: boxes, font sizes, line breaks, colours, which graphics go where. A Scene is plain data: a list of items (`text`, `graphic`, `rect`, `ground`), each with its box, plus the safe area.
2. **paint(ctx, scene, t).** Draws a Scene. No decisions, no randomness beyond what the Scene carries.
3. **finish(ctx, spec).** The texture pass of section 7.

- `t` is time for motion. Phase 1 always passes `null` (still). Every graphic's draw function takes `t` from the first row on, so phase 2 adds motion without rewriting them.
- **Layout is a solver, not a single shot.** It draws candidates from the layout stream and returns the first that passes the invariants of 9.2. A candidate that would overflow, overlap or fail contrast is discarded, not painted. If none of 20 passes, it returns the style's fallback layout, which must always pass.
- **Text fits.** A text item gets the largest size at which it fits its box within the style's limits; it never overflows, clips or shrinks below the style's minimum (then the candidate fails).
- **Spacing by ink, not by font box.** Vertical gaps are measured from real glyph bounds, so a big title has no dead air above it.
- **Export draws at full size** on an offscreen canvas after fonts are loaded. It is never a scaled copy of the preview.
- The app exposes `window.__rstr = { scene(spec), render(canvas, spec), spec() }` for the tools.

## 5. Colour

A **palette** is roles, not colours in fixed places:

| Role | Use |
|---|---|
| `ground` | Background |
| `ink` | Text and line |
| `accent` | The loud colour |
| `accent2`, `accent3` | Optional; styles that use many colours need them |
| `gradient` | Optional list of stops; Vaporwave grounds |

- **Every palette has a light and a dark form**, both written by hand in the data file. Dark is not an automatic inversion. Mode picks the form.
- **Contrast:** any text against what is directly behind it reaches 4.5:1, or 3:1 for text of 60 px and up at 1080 wide (tested, 9.2). A style may put a plate behind text to get there.
- Each style lists its palettes in `src/data/palettes/<style>.ts`, at least 8 each by the end of phase 1. The spike's palettes are the starting set.
- **My palettes (Advanced):** edit any role of the current palette, save it under a name, delete it. Saved palettes join that style's list and the colour stream can pick them.

## 6. Type

A **pairing** is `{ id, name, display, text, mono, notes }` naming font families and the weights used. The starting list is `docs/design/pairings.md`: 42 pairings across the four styles, with Swiss leaning on single grotesque families.

- **Free fonts only**, which here means families on Google Fonts. Nothing licensed is ever shipped or fetched.
- **Web app: fonts are fetched online, on demand.** Picking or shuffling to a pairing loads its families and weights from Google Fonts, and only those. A service worker caches every font file fetched, so a pairing used once works offline afterwards.
- **A core set is bundled** with the web app so it always draws, online or not: the eight families of the spike (Inter Tight, Bricolage Grotesque, Instrument Serif, DM Mono, Anton, Archivo Black, Unbounded, Silkscreen). Each style's default pairing uses only core fonts.
- **APK: every font of every pairing is bundled.** `tools/fetch_fonts.py` downloads them at build time; licence texts go to `public/LICENSES.txt`.
- **Never lay out with the wrong font.** Layout waits for the pairing's fonts. If they have not arrived in 4 s (offline, never cached), the design is drawn with the style's default pairing, a small note says so, and the spec keeps the pairing that was asked for. Shuffle prefers pairings whose fonts are already available when offline.
- Export waits for fonts the same way.
- Each style lists the pairings it allows. Swiss: grotesques, alone or with a serif for the subtitle. Brutalist: heavy display faces with a mono.
- The type seed picks the pairing; `pick.pairing` overrides it.
- Pairing lists found on the web (Typewolf and the like) are reading for whoever curates the file. The app fetches font files, never pairing data.
- **Own fonts (row R11):** load a TTF, OTF or WOFF2 from the phone, kept in IndexedDB, usable as display or text in a custom pairing.

## 7. Finish and marks

### 7.1 Finish

A pass over the composed image. A finish is not a style: any style takes any finish.

| Finish | What it does |
|---|---|
| Clean | Nothing |
| Grain | Fine film grain, a little vignette |
| Grunge | Grain, photocopy dust, faint horizontal streaks, nibbled edges with bigger bites at the corners, slight ink spread on type |
| VHS | Chroma bleed, scanlines, streak grain, a tracking band, head-switching noise at the bottom |
| Glitch | Slice displacement with RGB split, scanlines, corruption bars, one pixel-sort smear |

- Recipes: `docs/design/elements.md`. Deterministic from the graphic seed.
- **Two passes for VHS and Glitch:** ground and graphics, then the effect, then every text item on top. These effects never touch text.
- **Grain and Grunge cover everything**, then the title is stamped again at part strength so its edges hold. No colour ghost on type.
- The contrast rule of section 5 is checked before the finish, and a finish never takes a text item under 3:1 (tested).
- When a finish other than Clean is on, text set in a light weight steps up one weight.
- Advanced has a strength dial per finish.

### 7.2 Marks

A layer of small technical graphics over any style: brackets, tick rulers, a crosshair, slashes, a barcode strip, status cells, micro labels, and containers for text (chamfered card, highlight bar, underline bar). The library is `docs/design/elements.md`.

- `marks`: off, light (three or four marks in free corners and edges), full (also the containers: info goes in a chamfered card, the title gets an underline bar and a micro label).
- Placed by the layout stream after text and graphics, in free space only. A mark never sits on a text item.
- Micro labels carry only what the spec knows (seed, format, style, palette, date, counter). Nothing invented that reads as a fact.
- Colours come from the palette roles. Each style may restrict which marks suit it; Swiss takes rulers, crosshair, grid and brackets, Brutalist takes barcode, status cells and slashes, Vaporwave and Postmodern take all.

## 8. Styles

A style is a rule set: its layouts, the graphics it allows, how it sets type, its palettes and pairings. `docs/design/refs/` shows each. Swiss and Postmodern were approved by Pedro on 23 Nov 2026 ("I love the post modern style", "the swiss as well"): keep their character when extending them. Brutalist and Vaporwave refs are a first pass he has seen but not judged.

### 8.1 Swiss

After Müller-Brockmann. The grid is the design.

- 6 columns, one margin (72 px at 1080), one rhythm unit between everything.
- Flush left, ragged right, sentence case as typed. One grotesque family, heavy for the title, regular for the rest. Tight tracking on the title.
- One accent. Ground, ink, accent, and nothing else in a design.
- Title and subtitle share an axis that sits on a column line (column 0, 1 or 2). Info is up to three label/value columns on the same axis, above a rule; caption under the rule, small, tracked, upper case.
- Layouts: graphic above, graphic below, full-bleed graphic with a ground-colour plate for text, graphic as a column band beside the text, type only. Graphics snap to grid modules and may bleed off the canvas edge.
- Graphics: topo (contour lines, every fourth one heavier and in the accent), blocks, bars (stripes in arithmetic progression at an angle), dots (a field that swells toward a point), disc; added in R5: rules, numeral (one huge figure used as a shape), crosshairs, grid, rings, waves.

### 8.2 Postmodern

Memphis and new-wave energy. Loud, tilted, layered, friendly.

- Ground with a faint pattern: dots, grid or confetti.
- Five to eight shapes on a jittered lattice, each rotated, each with a hard offset shadow in ink: striped block, half disc, triangle, squiggle, dot square, stairs, ring; added in R6: checker, arc, zigzag band, pill, cross, wedge.
- Title in upper case, one tilted strip per line, each strip a different fill, strips stepping sideways, hard shadow.
- Subtitle in serif italic on a highlight plate, tilted the other way. Info in mono inside a bordered box with a shadow. Caption in mono running up the left edge.
- Three accents plus ink and ground.
- Shapes may sit behind text plates; they never sit on top of text.

### 8.3 Brutalist

HEAVY TYPE. The title is the graphic.

- Upper case. One word per line up to four words, otherwise three balanced lines. **Every line is scaled to fill the full width**, then the whole block is stretched vertically to fill the height it has (0.55 to 1.9 times). Stretched type is the point.
- One line sits on a full-bleed accent bar.
- Thick rules. Caption in mono in a strip between rules at the top with a small format tag at the right. Subtitle in mono inside a solid ink bar. Info as a table: one row per pair, label left in mono, value right in the heavy face, a rule between rows.
- Narrow margin (about 48 px at 1080). Two colours and one accent. No decoration.
- Left-over space gets one blunt graphic: barcode stripes, an accent slab with a disc, a row of asterisks, an arrow, a huge numeral.
- R8 adds: title set at 90 degrees up the edge, title cropped by the canvas edge (Advanced only, off by default), boxed variant with a full border.

### 8.4 Vaporwave

- Gradient sky, horizon between 56% and 64% of the height, a sun with slits that widen downward, a perspective grid floor with a glow, sparkle stars.
- Title in a wide heavy face, upper case, centred: gradient fill split at the middle like chrome, a light outline, two offset copies in accent colours.
- Subtitle in wide-tracked upper case. Info in a plain window with a title bar and three squares, pixel face inside. Caption centred at the bottom in mono.
- R9 adds: wire sphere, checker floor, floating window stack, gradient bars, horizon mountains as a polyline, a second sun layout with the title in the sky or on the floor.
- No statues, palms, logos of old software or Japanese text set for effect. Those need real assets and real words; phase 3 lets Pedro upload them.
- Light mode is a pastel sky with dark ink.

### 8.5 Text slots

Title, subtitle, info (up to three label/value pairs), caption. Each is on or off. An off slot gives its space back. With every slot off, the design is a background plate.

- Each style defines two or three positions per slot. The layout stream picks; `text.<slot>.pos` overrides (Advanced).
- A line break typed in the title is kept.

## 9. Proof

### 9.1 Scripts

- `npm run check`: types, unit tests (seeded generator, palette contrast maths, spec migration, stream independence on a stub measure), build.
- `npm run smoke`: headless Chrome on the built app. Walks every tab in both modes at 360 x 640 and 412 x 915, taps Shuffle, exports, and runs 9.2 and 9.3.
- `npm run sheet`: contact sheets to `shots/`: per style, 12 designs across the three formats, in light and dark, plus one sheet per finish. Also saves every screen of the app.

### 9.2 Invariants, checked on the Scene

For every style x format x mode, over 200 seed sets, with short, typical and long text (title of 1 word, 3 words, 8 words; every slot on, and each slot alone):

1. No text item leaves the canvas or, in 9:16, enters the story zones.
2. No two text items overlap.
3. No graphic is drawn over a text item (a plate under text is fine).
4. Every text item meets the contrast rule of section 5.
5. No text item is below its style's minimum size.
6. The export is a JPEG or PNG of exactly the format's pixels.

Any failure prints the spec that caused it, so it can be opened in the app.

### 9.3 Determinism

- The same spec drawn twice gives identical pixels.
- Changing only the colour seed leaves every box in the Scene where it was. The same for the type seed against graphics, and the graphic seed against text boxes.

### 9.4 What the scripts cannot say

Whether it looks good. The reviewer looks at the sheets and lists seeds that are legal but clumsy (dead space, a cramped title, a graphic that fights the text). Pedro has the last word.

## 10. Screens

### 10.1 The frame

Same on every tab, both modes, nothing scrolls:

1. **Header:** RSTR wordmark, the seed as a chip (tap copies it), Kept, the Simple/Advanced switch.
2. **Stage:** the design, as large as fits.
3. **Format** (1:1, 3:4, 9:16) and, from phase 2, Still/Motion.
4. **Locks:** Layout, Colour, Graphic, Type. A locked facet survives Shuffle.
5. **Panel:** the current tab's controls, fixed height, page chips when they do not fit.
6. **Action row:** Back, Shuffle (the big one), Keep, Export.
7. **Tab bar.**

- **Shuffle** makes new seeds for every unlocked facet and clears that facet's pick.
- **Back** returns to the design before the last change; 30 steps are kept.
- **Keep** saves the spec to Kept. Kept is a sheet of thumbnails; tap opens one, hold deletes.
- **Export sheet:** sizes (any of the three), JPEG or PNG, Save (download) and Share (the system share sheet with the files, shown only where the browser supports sharing files). Names: `rstr-<seed>-<format>.jpg`.
- The current design, Back steps, Kept and My palettes are saved on the phone and return on reload.
- Controls at least 48 px. Text on a tile or button never wraps and never overflows: it shrinks to fit, then shortens.
- Look of the app: dark and quiet so the poster is the only colour on screen. `docs/design/refs/ui-*.jpg` is the reference. DM Sans only, bundled. Material Symbols outlined as SVG for icons.

### 10.2 Simple

For zero-thinking use. Three tabs.

| Tab | Controls |
|---|---|
| Style | The four styles as tiles, each tile a small live render |
| Text | Four rows: slot name, field, on/off |
| Look | Light/Dark, Finish (Clean, Grain, Grunge, VHS, Glitch), Marks (Off, Light, Full), and four reroll buttons: New layout, New colours, New graphic, New type; page chips if it does not fit one page |

### 10.3 Advanced

Everything Simple has, plus the parameters. Six tabs: Style, Layout, Graphic, Type, Colour, Text.

| Tab | Controls |
|---|---|
| Style | Style tiles, Finish with a strength dial, Marks with a picker of which marks are allowed, Light/Dark |
| Layout | Layout picker (the style's layouts by name), margin, graphic share, axis column or tilt or horizon (whatever the style has) |
| Graphic | Motif picker, density, scale, line weight, angle, New graphic |
| Type | Pairing picker, title case (as typed, upper, lower), title weight where the family has it, tracking, size cap |
| Colour | Palette picker, each role editable, Save as mine |
| Text | Each slot: field, on/off, position |

- Every Advanced control writes a `pick` or a `params` value. A value set by hand survives Shuffle only if its facet is locked; otherwise Shuffle clears it.
- A style shows only the controls it has. Controls are generated from the style's parameter list, not written per style.
- Spec in and out (Advanced, Style tab, second page): Copy spec, Paste spec.

## 11. Later, outline only

Each needs a Fable chat to specify before it is built.

- **Phase 2, motion:** a device test of MP4 export first (WebCodecs with an MP4 muxer; MediaRecorder as the fallback), then entrances and loops per style, 6 s default, 30 fps, silent. The motion vocabulary to start from is at the end of `docs/design/elements.md`.
- **Phase 3:** photo as ground (crop, grade, duotone), uploaded PNG and SVG assets as graphics, brand kits (a saved palette, pairing, logo and fixed text layout; no particular brand planned), batch from a list, sound from the groovebox engine, the APK.
- **More styles:** Bauhaus, Constructivist, Y2K. Not before the first four hold up.
